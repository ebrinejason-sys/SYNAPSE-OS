# Identity / session decision — Release 0

**Date:** 2026-08-01  
**Status:** Interim decision for Release 0–1

## Decision

| Surface | Auth truth |
|---|---|
| `apps/web` (OS + platform) | Custom `@synapse/auth` `synapse_session` cookie/JWT |
| `apps/pharmacy` | Same `synapse_session` cookie |
| `apps/app` (Expo) | Bearer `synapse_session` token in SecureStore |
| Supabase Auth | Fallback/migration only — not primary session |

## Why

The monorepo already mints and validates `synapse_sessions`. Dual-primary auth increases bypass risk. Release 1 will add account/person/membership without inventing a third session system.

## Follow-ups (Release 1)

- Single trusted request context for all products.
- Person (MPI) distinct from login account.
- Membership + role assignment per facility.
- Device binding for mobile sessions.
