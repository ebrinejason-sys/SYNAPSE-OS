# Platform Access Model

## Overview

`admin.synapseos.tech` uses the **existing SYNAPSE identity** (`profiles`, `synapse_sessions`, MFA, password reset). Control-plane authorization is layered via `platform_memberships` — not a separate login system.

## Tables

| Table | Purpose |
|-------|---------|
| `platform_memberships` | Active control-plane role, status, MFA/password flags, expiry |
| `platform_invitations` | Single-use hashed invite tokens |

## Roles

| Role | Intent |
|------|--------|
| `SUPER_ADMIN` | Full control-plane authority |
| `PLATFORM_ADMIN` | User/access management, operations (cannot manage SUPER_ADMIN) |
| `RELEASE_MANAGER` | Deployments & releases |
| `SECURITY_ADMIN` | Security summary, session/MFA admin |
| `FINANCE_ADMIN` | Finance summary metrics |
| `SUPPORT_ADMIN` | Support-tier password reset |
| `CLINICAL_GOVERNANCE` | Clinical readiness observation |
| `STAKEHOLDER` / `BOARD_OBSERVER` / `INVESTOR_OBSERVER` / `TECHNICAL_OBSERVER` / `AUDITOR` / `READ_ONLY_OBSERVER` | Read-only governance |

Capabilities are defined in `apps/web/src/lib/platform/rbac.ts`.

## Status lifecycle

`INVITED` → `ACTIVE` → (`SUSPENDED` | `REVOKED` | `EXPIRED`)

Historical audit is preserved; memberships are not hard-deleted.

## Migration from binary admin

1. Existing `profiles.role = platform_admin` → `PLATFORM_ADMIN` membership (migration seed)
2. `ADMIN_EMAILS` → emergency bootstrap `SUPER_ADMIN` (env-only, not long-term DB)
3. Authorization checks membership + capability; legacy paths remain temporarily

## API & UI

- **UI:** `/platform/access`, `/platform/access/[id]`, `/platform/performance`
- **API:** `/api/platform/access` (read members)
- **Invite accept:** `/platform/invite/[token]`

## PHI boundary

Observer roles receive aggregate/synthetic evidence only. No patient identifiers, clinical notes, lab results, or secret values.
