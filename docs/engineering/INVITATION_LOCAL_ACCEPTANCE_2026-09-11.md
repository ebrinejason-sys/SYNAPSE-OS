# Local invitation acceptance — 2026-09-11

Implemented a one-command disposable PostgreSQL 16 runner:

```sh
npm run test:invitations:postgres
```

It creates its own container with a random password and loopback-only dynamic
port, applies the reduced prerequisite fixture and actual acceptance/MFA SQL,
executes assertions, and removes only that container on exit. It does not use
the linked Supabase project or application database credentials.

Result: **23 passed, 0 failed**, including actual denied calls by anon and
authenticated roles, concurrent redemption, existing-password preservation,
multi-facility assignment, profile-write rollback, final-audit-write rollback,
retry after rollback, and the fixture's membership read policy.

This closes the isolated PostgreSQL RPC execution gap. It does **not** prove
the complete historical migration chain, production schema parity, HTTP
acceptance, or broader clinical tenant isolation. Seven pre-existing
PostgREST integration tests still need their configured isolated Supabase
environment; these are separate from the 23 SQL assertions.

Added the database runner and MFA boundary tests to required CI, with retained
database logs. Fixed an MFA race: an assurance update must return the still-live
session row; zero updated rows after revocation/expiry now fail closed.

Additional local verification:
- MFA persistence-boundary tests: 4 passed.
- Control-plane suite: 73 passed, 7 PostgREST integration tests skipped.
- Workflow safety, migration-history checker, reconciliation-evidence checker,
  and readiness-report tests: 34 passed.
- Web TypeScript and lint: passed.
- Full web production build: passed (exit 0), including type validation,
  generation of all 288 static pages, and build traces.
- Working diff whitespace check: passed.

CI steps were added but no remote CI run was initiated or verified here.

The full historical chain remains blocked by the missing pharmacy_customers
dependency. Production invitations remain disabled and production migrations
remain unapplied. HTTP enablement requires the deployment's schema acceptance
and an authenticated end-to-end journey; this report does not authorize it.

The existing staged work was preserved. No production operations were run.
