# Platform Admin Password Reset

## Rules

- Admins **never** see existing passwords
- All reset actions require a **reason** and write audit events
- Passwords and tokens are **never** logged

## Admin-initiated reset (preferred)

1. Platform Admin opens member detail → **Reset Password**
2. Enters reason
3. System mints single-use `password_reset_tokens` entry (15 min TTL)
4. Optional: revoke all sessions (`revoke_sessions=true`)
5. Sets `password_change_required` on membership
6. Sends branded reset email via existing `sendUserPasswordReset`
7. Audit: `PLATFORM_MEMBER_PASSWORD_RESET_REQUESTED`

## Temporary password (optional)

Available when admin has `user.password_reset` and may manage target role.

1. Cryptographically random password generated
2. Shown **once** in UI
3. Stored as bcrypt hash only
4. `must_change_password` + `password_change_required` set
5. All sessions revoked
6. Audit: `PLATFORM_MEMBER_TEMP_PASSWORD_ISSUED` (no password in metadata)

## Self-service

`/platform/login` → Forgot password → existing public flow (`/api/auth/password-reset/request`).

Neutral response prevents account enumeration.

## Role hierarchy

| Actor | Can reset |
|-------|-----------|
| `PLATFORM_ADMIN` | Observers and lower roles |
| `PLATFORM_ADMIN` | Not `SUPER_ADMIN` |
| `SUPER_ADMIN` | All roles |

## High-risk variant

**Reset password and revoke sessions** — combined action for compromised accounts.
