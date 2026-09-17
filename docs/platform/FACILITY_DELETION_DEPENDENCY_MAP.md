# Facility lifecycle and deletion dependency map

This map is the safety contract for platform-admin lifecycle work. It is based
on the current migration graph and must be checked against live schema metadata
before any destructive operation. No action may rely on database cascade delete.

| Relation / domain | Classification | Required behavior |
|---|---|---|
| `staff_scope_assignments` | DETACH_MEMBERSHIP | Deactivate only this facility scope; preserve shared profiles and other scopes. |
| `profiles`, `persons`, `person_identifiers` | PRESERVE_GLOBAL_IDENTITY | Never delete because a facility is removed; retain audit identity. |
| `staff_invitations` | REVOKE | Revoke pending invitations for the facility. |
| `patients`, `encounters`, clinical notes | ARCHIVE_WITH_FACILITY | Preserve clinical history under retention policy; block hard deletion by default. |
| lab orders/results and prescriptions | ARCHIVE_WITH_FACILITY | Preserve provenance and immutability; no cascade deletion. |
| billing, insurance, ledgers, payments | BLOCK_DELETION | Financial records require retention/manual review. |
| pharmacy products, batches, stock movements | ARCHIVE_WITH_FACILITY | Preserve stock and transaction audit; reconcile before archive. |
| pharmacy stores/departments/locations | DELETE_WITH_FACILITY | Archive or detach after dependent stock is handled. |
| devices, offline sessions, active sessions | REVOKE | Revoke tokens/sessions and disable facility devices. |
| subscriptions and grants | ARCHIVE_WITH_FACILITY | Cancel/suspend through billing policy; retain invoices and grants history. |
| domains/subdomains/integrations | REVOKE | Disable mappings, webhooks, API credentials, and integrations before archive. |
| audit/access logs | PRESERVE_GLOBAL_IDENTITY | Immutable retention; actor and target identifiers remain addressable. |
| tenant/facility record | ARCHIVE_WITH_FACILITY | Transition `ACTIVE → DELETION_PENDING → ARCHIVED`; physical deletion is exceptional. |

## Required preview contract

Before a delete or purge action, the control plane must present facility state,
staff totals (exclusive/shared), affected domain counts, integrations/domains,
retention blockers, and the exact actions to be taken. The preview must be
tenant-scoped and must not accept a client-supplied replacement tenant.

## Lifecycle states

Use `ACTIVE`, `SUSPENDED`, `ARCHIVED`, `DELETION_PENDING`, and `DELETED`.
`PURGED` is reserved for explicitly synthetic facilities after the preview,
retention checks, confirmation, and audit record. Production facilities with
financial or clinical history remain archive-only unless an approved retention
process authorizes otherwise.

## Verification required before implementation

Query `pg_constraint` for every foreign key referencing facility/tenant IDs,
review each `ON DELETE` action, and compare it with this map. Add explicit
service-layer guards and tests for shared staff, signed encounters, billing,
stock, and cross-tenant access before enabling destructive endpoints.
