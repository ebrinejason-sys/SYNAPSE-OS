# Tally migration architecture

## Goal

Move an existing Tally pharmacy into Synapse without creating a second inventory,
accounting, or clinical authority. Version one is file-based and remains staged
until an authorised operator commits it.

## Existing and reusable

- `portal/import-assistant` and `api/admin/import-sessions` provide the current
  staged import session and review surface.
- `api/admin/inventory/bulk-upload` and `packages/db/src/import-validation.ts`
  provide row validation and the existing inventory authority.
- `import_batches`, `import_batch_rows`, `import_column_mappings`, and
  `pharmacy_import_sessions` are the canonical staging records.
- Pharmacy products, packages, batches, suppliers, customers, purchases, sales,
  stock movements, billing, FEFO, RLS, tenant checks, audit, and idempotency
  remain the canonical domain services.

## Missing / new work required

1. Add a `MigrationSourceAdapter` contract with Tally XML, Tally JSON,
   spreadsheet, and generic CSV implementations. Adapters parse untrusted files
   into a bounded, provider-neutral discovery model; they never write domain rows.
2. Add a Tally migration workspace at `/portal/migration/tally`, linked from the
   import assistant (renamed in UI to “Data Migration Center”). Keep generic
   CSV/XLSX import available.
3. Extend the existing session/batch records (or add a dedicated provenance
   table only where a column cannot be safely added) for source company identity,
   source object identity/hash, financial period, dry-run, phase, reconciliation,
   cutover, and rollback status.
4. Implement deterministic mapping and review queues for products, units,
   categories, godowns, suppliers, customers, batches, and transactions.
5. Route committed inventory through existing receipt/stock authorities and
   committed money through existing billing/accounting authorities. A Tally sale
   must never become a clinical prescription or diagnosis.
6. Add reconciliation, exception, duplicate, missing-expiry, and cutover reports,
   with operator confirmation for medium/low-confidence matches.

## Required flow

`analyse → map → stage → validate → reconcile → dry run → commit → verify → cutover`.

Masters precede inventory; inventory precedes transactions; accounting and
reconciliation follow the dependent phases. Every phase is tenant-scoped,
audited, retry-safe, and idempotent on `(source_system, company_identity,
source_object_id, source_hash)`.

## Input safety

Uploads are untrusted. Enforce MIME/size/row limits, reject XML entities and
malformed documents, parse JSON safely, never execute spreadsheet formulas, and
neutralise CSV formula prefixes. Raw imported HTML is never rendered.

## Identity and matching

Prefer Tally GUID, then SKU/barcode, normalized exact name, and finally a
suggestion-only fuzzy match. Deterministic matches may auto-map; medium and low
confidence matches require review. Strength, dosage form, and pack size are part
of medicine identity—similar names must not collapse.

## Safety gates

No production writes during analysis, mapping, or dry-run. Missing batch expiry is
an explicit `EXPIRY_MISSING` exception and does not become sellable stock without
policy approval. Commit requires reconciliation approval, audit success, and
idempotency checks. Rollback is a compensating action, never deletion of source
history. Production database resets and automatic migration repair are out of
scope.

## Future adapters

The adapter boundary leaves room for TallyPrime local HTTP/XML, JSON, ODBC, and a
Synapse Tally Bridge in a later version without changing the canonical staging or
domain commit pipeline.
