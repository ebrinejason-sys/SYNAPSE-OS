# Quarantined local-only migrations (2026-09-11)

These files had versions **not** present in production `schema_migrations` for
`qfqakzmjatszisuqjwon`. Leaving them in `supabase/migrations/` would make
`supabase db push` attempt to apply them on top of an already-evolved production
schema.

They are preserved here for forensics — **do not** move them back without a
reviewed plan. True pending-new migrations stayed in `supabase/migrations/`.

Pending-new retained:
- `20260908120000_lab_reports_release_artifacts.sql`
- `20260909100000_manual_subscription_grants.sql`
- `20260909130000_scope_pharmacy_receipts_to_tenant.sql`
- `20260910120000_facility_invitations_token_hash.sql`
- `20260910130000_facility_invitations_acceptance_tx.sql`
- `20260911100000_session_bound_mfa_assurance.sql`

Quarantined count: 62
