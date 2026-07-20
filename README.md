# Synapse OS

Multi-tenant AI health operating system for Uganda — hospital OS, pharmacy POS, and mobile client.

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

- `SETUP_GUIDE.md` — local env and first-run
- `docs/deploy.md` — Vercel / CI
- `docs/FLUTTERWAVE_SETUP.md` — subscription billing
- `SYNAPSEOS_MRD.md` — product direction
- `apps/app/GUIDE.md` — mobile architecture

## Production URLs

- Web / admin / app hosts → `apps/web` (`synpase-os`)
- Pharmacy → `pharm.synapseos.tech` (`synapse-pharm`)
