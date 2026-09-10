# Migration History Baseline

The read-only migration inventory uses Git commit `e624986` as its explicit historical baseline unless `MIGRATION_HISTORY_BASELINE` overrides it.

`20260609_missing_operational_tables.sql` and `20260609_pharmacy_network_onboarding.sql` are documented legacy version exceptions. Both retain the historical `20260609` prefix because they are already part of the migration history; new migrations must use unique numeric prefixes.

The checker records raw and normalized SQL SHA-256 hashes, latest Git provenance, additions, deletions, and modifications. It does not reconcile the remote Supabase ledger. Remote compatibility remains an operator-controlled prerequisite for production application.