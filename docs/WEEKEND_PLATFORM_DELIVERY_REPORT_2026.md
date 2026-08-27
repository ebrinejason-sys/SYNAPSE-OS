# Weekend platform delivery report — 2026-08-27

Branch: `cursor/synapse-integrated-platform-milestone-9076`

## Completed

- Repository audit (`docs/WEEKEND_PLATFORM_AUDIT_2026.md`) classifying operational / partial / prototype / mock / placeholder / roadmap / stop-ship items.
- Shared **capability manifest** (`packages/config/src/product-manifest.ts`) used by `synapseos.tech` and `admin.synapseos.tech`.
- Synapse Exchange domain events + idempotent outbox (`packages/interop/src/events.ts`, `packages/db/src/exchange.ts`, table `synapse_domain_events`).
- Identity crosswalk helpers (canonical person + namespaced aliases; no auto-merge).
- Synapse Lab order→result state machine with rejection, amendment, critical acknowledgement. Reuses `lab_orders` / `lab_specimens` / `lab_results`.
- Versioned **adult sepsis** pathway (guideline → pathway → care plan) with required override reasons and `may_train_models = false`.
- Deterministic Simulation Lab engine. Seed `20260829` + `sepsis-critical-lab` reproduces the same synthetic patient and event chain. Production reset is blocked.
- Platform Control Center sections: registry, monitoring (honest probes), simulation, events, modules, integrations, incidents, database (no SQL console), deployments, mobile/EAS.
- Public landing rewrite: one-system story, connected journey, architecture visual, product vs platform split, honest integration badges. Hero `0+` counters replaced with capability statements.
- Pharmacy clinical prescription queue (verify/dispense permissions remain separate).
- Automated tests for identity, lab, pathway, events, simulation, prescription bridge, demo-reset isolation.

## Partially completed

- Lab and pathway **UIs** are demo/worklist quality, not a full LIS or specialty EMR.
- Simulation persistence is best-effort until the new migration is applied to each environment.
- Non-sepsis scenarios are generated as synthetic skeletons.
- Hospital registration is not fully rewritten onto `persons` (helpers exist; OPD register still uses facility `patients`).
- FHIR HTTP resources remain 501 placeholders.
- Live analyzer ingest remains a mock.
- GitHub/EAS/Vercel monitors show NOT CONFIGURED unless tokens exist.

## Roadmap

- Full LIMS (microbiology, blood bank, QC/EQA, analyzers).
- Imaging/DICOM, DHIS2 live export, UgandaEMR/ALIS/eAFYA adapters.
- Synapse Edge / durable facility offline.
- Certified country packs and MPI merge/unmerge UI.
- Governed intelligence evaluation harness.

## Security findings

- Platform admin MFA boundary is preserved. Simulation and event APIs require platform admin.
- Event explorer masks patient ids.
- Demo reset cannot target `production` tenants.
- No browser SQL console was added.
- Pre-existing `SECURITY DEFINER` RPC ACL review remains a live-database P0 from the master blueprint — not closed in this milestone.
- Pharmacy web offline checkout remains disabled (`OfflineUnavailableError`).
- Service-role is still used for platform admin APIs (existing control-plane pattern). New tables enable RLS and revoke `anon`/`public`.

## Database changes

Migration: `supabase/migrations/20260828090000_synapse_exchange_lab_pathways_simulation.sql`

- Tenant classification columns (`environment`, `is_synthetic`, `data_classification`)
- Lab workflow columns on existing `lab_orders` / `lab_results` / `patients` / `encounters`
- `synapse_domain_events`, `synapse_simulation_runs`
- `lab_result_amendments`, `lab_critical_acknowledgements`, `lab_reference_ranges`
- `pathway_overrides`, `clinical_prescriptions`
- `platform_incidents`, `platform_health_checks`, `platform_module_matrix`

**Not applied to production by this PR.** `npm run db:check` validates the file locally.

## Breaking changes

- Public homepage copy and metrics changed (intentional truth correction).
- FeatureTabs no longer claim live FHIR, nightly DHIS2, or autonomous lab AI.
- Compare table marks FHIR/offline/DHIS2 as No rather than Partial/Yes.

No pharmacy POS API contract was changed.

## Demo credentials / environment

No secrets. From a platform-admin session on `admin.synapseos.tech`:

1. Open Simulation Lab.
2. Create Demo Hospital.
3. Seed `20260829` / `sepsis-critical-lab`.
4. Inspect the event chain and open Lab worklist if the run was paused.

Synthetic patients are named `Demo …` and flagged `is_synthetic`.

## Test results

| Suite | Result |
|---|---|
| `@synapse/pharmacy` vitest (includes new integrated-platform tests, 175 tests) | pass |
| FEFO node:test | pass |
| `@synapse/web` type-check | pass |
| `@synapse/pharmacy` type-check | pass |
| `@synapse/web` lint | pass |
| `@synapse/pharmacy` lint | pass |
| `db:check` | pass (45 migration files) |

Not run: full `next build` of all apps; live Supabase `db push`; EAS; Playwright against admin MFA.

## Deployment status

Developed on a feature branch. Nothing in this milestone was deployed to production.

## Next 10 engineering tasks

1. **P0** Apply the new migration to staging and confirm RLS grants on the live catalog.
2. **P0** Finish live `SECURITY DEFINER` ACL inventory from the master blueprint.
3. **P0** Wire hospital `POST /api/patients/register` to `persons` + identifier crosswalk.
4. **P1** Persist simulation runs reliably and show them after process restart.
5. **P1** Complete malaria / DKA / pneumonia scenarios to the same depth as sepsis.
6. **P1** Replace FHIR CapabilityStatement mock with an honest roadmap document endpoint.
7. **P1** Connect one instrument parser to a real ingest worker (not a `{success:true}` stub).
8. **P2** EAS adapter once Expo credentials exist.
9. **P2** Public `/status` page driven by the same health probes (no fake uptime).
10. **P2** Regenerate `packages/db/src/types.ts` from the live schema.
