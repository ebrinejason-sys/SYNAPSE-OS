# SYNAPSE Health Ecosystem

Three-product health-platform monorepo in development: Synapse OS for facility care delivery, Synapse Pharm for medicines and supply operations, and Synapse App for patients, caregivers, communities, and mobile workforces, joined through a shared Core/Grid.

> **Current maturity:** this repository is not yet three production-grade offline-first systems. Treat capability, safety, interoperability, and rollout status according to the authoritative operating model and technical evidence linked below.

## Monorepo layout

| Path | Package | Role |
|------|---------|------|
| `apps/web` | `@synapse/web` | Marketing, hospital OS, platform admin, APIs (`synapseos.tech`) |
| `apps/pharmacy` | `@synapse/pharmacy` | Synapse Pharm POS / inventory (`pharm.synapseos.tech`) |
| `apps/app` | `@synapse/app` | Expo mobile client |
| `packages/*` | `@synapse/*` | Shared auth, db, email, config, ui |
| `supabase/` | — | Postgres migrations (project `qfqakzmjatszisuqjwon`) |
| `legacy/vite-demo/` | — | Quarantined old Vite demo — not deployed |

## Prerequisites

- **Node.js 22.x** (see `.nvmrc`)
- npm 10+
- Supabase project access
- Vercel projects: `synpase-os` (web), `synapse-pharm` (pharmacy)

## Quick start

```bash
cp .env.example .env
# Also copy app env templates as needed:
#   cp apps/web/.env.example apps/web/.env.local
#   cp apps/pharmacy/.env.example apps/pharmacy/.env.local

npm install

# Web platform — http://localhost:3001
npm run dev --workspace @synapse/web

# Pharmacy — http://localhost:3002
npm run dev --workspace @synapse/pharmacy

# Mobile
npm run start --workspace @synapse/app
```

## Verify before shipping

```bash
npm run db:check
npm run verify:web
npm run verify:pharmacy
```

See `docs/deploy.md` for Vercel project mapping and deploy gates.

## Documentation

- `docs/SYNAPSE_ECOSYSTEM_OPERATING_MODEL_2026.md` — authoritative three-product ecosystem, outcomes, ownership, architecture, and roadmap
- `docs/SYNAPSE_MASTER_BLUEPRINT_2026.md` — technical sweep, risk register, capability universe, and implementation annex
- `SETUP_GUIDE.md` — local env and first-run
- `docs/deploy.md` — Vercel / CI
- `docs/FLUTTERWAVE_SETUP.md` — subscription billing
- `SYNAPSEOS_MRD.md` — superseded historical product direction
- `apps/app/GUIDE.md` — mobile architecture

## Production URLs

- Web / admin / app hosts → `apps/web` (`synpase-os`)
- Pharmacy → `pharm.synapseos.tech` (`synapse-pharm`)
