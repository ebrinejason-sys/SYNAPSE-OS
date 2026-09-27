# Auth lifecycle: observability gap and backlog design

Status: backlog (design only, nothing applied). Branch: `fix/release-acceptance-round2`.
Scope: web (`apps/web`), pharmacy (`apps/pharmacy`), mobile BFF (`apps/web/src/app/api/auth/mobile`).

## 1. Current state (audited 2026-09-27)

There is no durable, queryable record of authentication events. Only state is kept,
and much of it is overwritten.

| Event | Where it is recorded today | Durable history? | Auditable (who / when / from where)? |
|---|---|---|---|
| LOGIN_SUCCESS | `synapse_sessions` row (ip, user_agent, created_at); `profiles.last_sign_in_at` (overwritten) | Partial (session rows are deleted on suspend/logout paths) | No actor-visible trail; no audit row |
| LOGIN_FAILURE | `profiles.login_attempts` counter and `locked_until` (reset on success) | **No** | **No** |
| RESET_REQUEST | `password_reset_tokens` row (deleted if the email send fails, superseded rows marked used) | Partial | No IP/UA; admin-initiated resets write `audit_log` (`user.password_reset_sent`, `PLATFORM_MEMBER_PASSWORD_RESET_REQUESTED`) |
| RESET_COMPLETION | `password_reset_tokens.used_at`, `profiles.password_changed_at` | Partial | No IP/UA, no audit row |
| OTP_REQUEST / OTP_VERIFY | `auth_otps` rows (attempt counters, consumed on verify) | Partial | No |
| MFA_EVENT (enrol / verify / fail / reset) | `mfa_enrollments` state; admin MFA reset is audited (`PLATFORM_MEMBER_MFA_RESET`) | Self-service events: **No** | Admin reset only |
| SESSION_REVOKE | `synapse_sessions.revoked_at` or row delete; admin revokes audited (`user.sessions_revoked`, `PLATFORM_MEMBER_SESSION_REVOKED`) | Self logout / reset-driven revoke: **No** | Admin-initiated only |
| IMPERSONATION | `audit_log` (`IMPERSONATION_START` / `IMPERSONATION_END`) | Yes | Yes |
| ACCOUNT SUSPEND / REACTIVATE | `audit_log` (`user.suspended`, `user.reactivated`, `PLATFORM_MEMBER_SUSPENDED` ...) | Yes | Yes |

Report fields:

- LOGIN_SUCCESS_LOGGED: partial (state only, not an event log)
- LOGIN_FAILURE_LOGGED: no
- RESET_REQUEST_LOGGED: partial (token table; admin-initiated audited)
- RESET_COMPLETION_LOGGED: partial (token used_at + password_changed_at)
- OTP_REQUEST_LOGGED: partial (auth_otps state)
- MFA_EVENT_LOGGED: admin reset only
- SESSION_REVOKE_LOGGED: admin-initiated only

Consequence: credential-stuffing, OTP abuse, or a compromised account cannot be
investigated after the fact, and there is nothing to alert on.

## 2. Proposed design

### 2.1 Table (proposed migration, not applied)

```sql
create table public.auth_events (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  event        text not null check (event in (
                 'login.success','login.failure','login.blocked_state','login.locked',
                 'otp.requested','otp.verified','otp.failed',
                 'mfa.enrolled','mfa.verified','mfa.failed','mfa.reset',
                 'reset.requested','reset.completed','reset.failed',
                 'session.created','session.revoked','session.revoked_all',
                 'account.suspended','account.reactivated')),
  app          text not null check (app in ('web','pharmacy','mobile','platform')),
  user_id      uuid null references public.profiles(id) on delete set null,
  email_hash   text null,          -- sha256(lower(email) || pepper) when user unknown
  outcome      text not null check (outcome in ('ok','denied','error')),
  reason       text null,          -- e.g. INVALID_PASSWORD, ACCOUNT_UNAVAILABLE, RATE_LIMITED
  ip           inet null,
  user_agent   text null,
  actor_id     uuid null,          -- admin performing revoke/reset, else null
  metadata     jsonb not null default '{}'
);
create index auth_events_user_time on public.auth_events (user_id, occurred_at desc);
create index auth_events_event_time on public.auth_events (event, occurred_at desc);
create index auth_events_email_hash_time on public.auth_events (email_hash, occurred_at desc) where email_hash is not null;
alter table public.auth_events enable row level security;  -- service role only; no policies
```

Append-only: revoke UPDATE/DELETE from all roles except a retention job; retain 400 days
(PDPO: store no plaintext email for unknown accounts, no OTPs, tokens, or passwords).

### 2.2 Writer

`packages/auth/src/auth-events.ts`: `recordAuthEvent(evt)`; fire-and-forget (never
changes an auth decision, never throws into the request), batched per request, with the
`ip` taken from `x-forwarded-for` (first hop, Vercel) and `user_agent` truncated to 256 chars.

Call sites: web `password-login`, `email-otp/{send,verify}`, `phone/{send,verify}`,
`mfa/{verify,verify-setup}`, `password-reset/{request,confirm}`, `logout`; mobile
`login`, `otp-verify`, `reset-password`; pharmacy `login`, `otp-{send,verify}`,
`forgot-password`, `reset-password`, `logout`; `createSession` / `revokeAllUserSessions`.

### 2.3 Use

- Platform `/platform/security`: per-user timeline plus failure heatmap (capability `security_summary.read`).
- Alerts: more than 20 `login.failure` for one `email_hash` / IP in 10 minutes; any `mfa.failed` burst on platform roles; `login.success` from a new country for platform roles.

## 3. Related lifecycle findings (not fixed on this branch)

1. **Web password-change enforcement.** `must_change_password` only picks the post-login
   redirect (`/reset-password`, which needs a token), and platform membership
   `password_change_required` (set by "issue temporary password") is never enforced.
   An admin-issued temporary password therefore stays usable indefinitely.
   Proposal: a `/platform/change-password` (and `/change-password`) page, plus a check in
   `getContext` / `requirePlatformAccess` that redirects every other route while either flag
   is set. Needs UI, so it is outside this branch's small-fix scope.
2. **Pharmacy registration enumeration.** `POST /api/auth/register` (pharmacy) answers 409
   "An account with this email already exists" (web signup is already generic). Proposal:
   generic 200 plus an "you already have an account" email. UX decision needed.
3. **Pharmacy forgot-password** issues reset links for archived / suspended accounts and has
   no rate limit (the web route delegates to `sendUserPasswordReset`; add the same state
   check and rate limiter to both).
4. **Invite routes mark new staff `verification_status='verified'`**
   (`hospital/admin/staff/invite`, `mobile/pharmacy/users`). Product decision: is
   facility-admin invitation a KYC attestation?

Fixed on this branch: suspension via platform membership across all login and session paths;
reset-completion and admin activation no longer write `verification_status='verified'`.
