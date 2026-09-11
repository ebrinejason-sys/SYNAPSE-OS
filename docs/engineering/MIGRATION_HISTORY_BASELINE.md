# Migration History Baseline

The read-only migration inventory uses Git commit `19ef5d0` (`19ef5d04626071eb3c15ef34cfba5d88b1182942`) as its explicit historical baseline unless `MIGRATION_HISTORY_BASELINE` overrides it.

That commit is the 2026-09-11 production ledger reconcile point: remote `schema_migrations` versions were materialized into `supabase/migrations`, and drifted local-only filenames were quarantined. Relative to the previous baseline (`e624986`), those renames look like deletions; the new baseline freezes the post-reconcile ledger so the integrity gate tracks future drift only.

Additive migrations after `19ef5d0` are expected warnings. Historical files present at the baseline must not be deleted or modified without a reviewed, checked-in exception in `scripts/check-migration-history.mjs`.

`20260609_missing_operational_tables.sql` and `20260609_pharmacy_network_onboarding.sql` remain documented legacy version exceptions where they still appear. New migrations must use unique numeric prefixes.

The checker records raw and normalized SQL SHA-256 hashes, latest Git provenance, additions, deletions, and modifications. It does not reconcile the remote Supabase ledger. Remote compatibility remains an operator-controlled prerequisite for production application.
