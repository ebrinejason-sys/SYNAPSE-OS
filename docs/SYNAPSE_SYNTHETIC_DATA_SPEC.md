# Synapse synthetic data spec

Engine: `packages/db/src/simulation.ts`.

Rules:

- Every generated record has `is_synthetic = true`, `data_classification = "synthetic"`, `simulation_run_id`.
- Names are prefixed `Demo …`. Never copy production names.
- Seeded PRNG (`mulberry32`). Same `seed` + `scenario` reproduces the same logical dataset.
- `tenantClassification === "production"` cannot run or reset.
- Reset requires demo classification **and** `isSynthetic === true`, checked server-side.

Scenarios: `opd-malaria`, `pneumonia`, `dka`, `sepsis-critical-lab` (complete vertical slice), `pharmacy-retail`, `stockout`, `insurance-claim`, `referral`.

Admin entry: `admin.synapseos.tech` → Simulation Lab (`/platform/simulation`).
