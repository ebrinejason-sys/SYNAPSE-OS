# Facility Provisioning Architecture (2026)

## Purpose

One durable control-plane workflow provisions first-class facilities:

- `hospital`
- `clinic` / `health_centre`
- `pharmacy`
- `laboratory`

## Source of truth

| Layer | Location |
|---|---|
| Catalog | `packages/db/src/facility-provision-catalog.ts` |
| Orchestrator | `packages/db/src/facility-provision.ts` |
| Hospital adapter | `packages/db/src/hospital-provision.ts` (re-exported) |
| Runs / steps | `facility_provisioning_runs`, `facility_provisioning_steps` |
| Invites | `facility_invitations` |
| Platform API | `/api/platform/facilities` |
| UI | `/platform/facilities`, `/platform/facilities/new` |

Compatibility routes (`/platform/hospitals/new`, `/api/platform/pharmacies`) call the same foundation.

## Lifecycle

1. Create run (`PENDING` → `RUNNING`)
2. Create tenant with `status=provisioning`, `is_active=false`
3. Execute audited steps (validate → … → finalize)
4. **Only finalize success** sets `status=active`, `is_active=true`
5. Any hard failure → run `FAILED`, tenant `failed` / inactive

`facility_provisioning_runs` is onboarding truth. Resume/retry is idempotent via `idempotency_key` and existing row checks.

## Module defaults

- **Hospital**: canonical hospital modules by level
- **Clinic / health centre**: core, registration, opd, clinical, billing, reports (+ optional lab/dispensing)
- **Pharmacy**: POS, inventory/FEFO, dispensing, network, staff, reports (not hospital OPD/IPD)
- **Laboratory**: core, registration, lab, billing, reports (no OPD/IPD/maternity/theatre unless configured)

## Administrator onboarding

Secure invitation only:

Platform Admin → profile reservation → single-use invite → password set by admin → MFA when configured

Never email a permanent password. Never store plaintext passwords.
