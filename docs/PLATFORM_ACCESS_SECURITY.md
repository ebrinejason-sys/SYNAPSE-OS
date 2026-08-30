# Platform Access Security

## Authentication

- Reuses SYNAPSE custom auth (password → email OTP → TOTP for control-plane)
- MFA mandatory for: `SUPER_ADMIN`, `PLATFORM_ADMIN`, `SECURITY_ADMIN`, `RELEASE_MANAGER`
- Strongly recommended for all stakeholder accounts (`mfa_required` on membership)

## Invitations

- Single-use tokens stored as SHA-256 hash (`hashInviteToken`)
- 72-hour expiry
- Rate-limited via existing email/OTP infrastructure
- Revocable before acceptance
- Never pass role authority in unsigned query params

## Sessions

- Listed by app, created/last-used/expiry — **no bearer tokens exposed**
- Revoke one or all sessions with reason + audit
- Suspension revokes all sessions automatically

## High-risk actions (reason required)

- Role change / escalation
- SUPER_ADMIN assignment (SUPER_ADMIN actor only)
- Password reset by admin
- MFA reset
- Suspension / revocation
- Session revoke-all

## Audit events

Written to `audit_log` and `platform_audit_events`:

- `PLATFORM_MEMBER_INVITED`
- `PLATFORM_MEMBER_INVITATION_RESENT`
- `PLATFORM_MEMBER_INVITATION_REVOKED`
- `PLATFORM_MEMBER_ACTIVATED`
- `PLATFORM_MEMBER_ROLE_CHANGED`
- `PLATFORM_MEMBER_SUSPENDED`
- `PLATFORM_MEMBER_REACTIVATED`
- `PLATFORM_MEMBER_REVOKED`
- `PLATFORM_MEMBER_PASSWORD_RESET_REQUESTED`
- `PLATFORM_MEMBER_TEMP_PASSWORD_ISSUED`
- `PLATFORM_MEMBER_MFA_RESET`
- `PLATFORM_MEMBER_SESSION_REVOKED`

Fields: actor, target, action, reason, before/after, correlation ID.

## PHI & secrets boundary

Control-plane observers must not receive:

- Patient names, notes, lab results
- API keys, env secret values
- Raw SQL or database credentials

Use aggregate metrics and golden journey **pass/fail** status only.

## Emergency bootstrap

`ADMIN_EMAILS` env var grants legacy access when `PLATFORM_LEGACY_ADMIN_EMAILS !== 'false'`. Migrate to `platform_memberships` and disable for production hardening.
