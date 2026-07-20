# Synapse OS — Setup Guide

Local setup for the **current** monorepo (`apps/web`, `apps/pharmacy`, `apps/app`).  
The old root Vite demo lives under `legacy/vite-demo/` and is not required.

## Prerequisites

- Node.js **22.x** (`nvm use` reads `.nvmrc`)
- npm 10+
- Access to Supabase project `qfqakzmjatszisuqjwon` (or a local Supabase stack)
- Optional: Gemini, Resend, Flutterwave, LiveKit keys for full features

## 1. Environment

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/pharmacy/.env.example apps/pharmacy/.env.local
```

Minimum variables for local web + pharmacy:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SYNAPSE_JWT_SECRET=...   # custom auth signing secret
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_PHARMACY_APP_URL=http://localhost:3002
```

Fill Flutterwave / Resend / Gemini only when testing those flows.  
See `apps/web/.env.example` and `docs/FLUTTERWAVE_SETUP.md`.

## 2. Install

From the repo root:

```bash
npm install
```

This installs npm workspaces: `apps/web`, `apps/pharmacy`, `apps/app`, and `packages/*`.

Root `.npmrc` sets `legacy-peer-deps=true` so Expo (React 18) can coexist with Next apps (React 19) in one install.

## 3. Database

Migrations live in `supabase/migrations/`. Prefer the linked remote project for pharmacy work (schema is already ahead of the app in places).

```bash
npm run db:check          # local SQL / naming checks
npm run db:link           # once: link CLI to the project
npm run db:migration:list
```

Do **not** recreate migrations that are already applied live. Add new ones only for schema changes you own.

## 4. Run apps

| App | Command | URL |
|-----|---------|-----|
| Web | `npm run dev --workspace @synapse/web` | http://localhost:3001 |
| Pharmacy | `npm run dev --workspace @synapse/pharmacy` | http://localhost:3002 |
| Mobile | `npm run start --workspace @synapse/app` | Expo Metro |

Turbo (all workspace `dev` scripts):

```bash
npm run dev
```

## 5. Verify

```bash
npm run type-check
npm run verify:web
npm run verify:pharmacy
```

CI (`.github/workflows/deploy.yml`) runs migration checks, web build, pharmacy type-check/build, and web lint on PRs to `main`.

## 6. Deploy notes

- **Never** treat root `npm run build:demo` as production — that path is gone; demo is quarantined.
- Web deploys from repo root via `vercel.json` → `@synapse/web`.
- Pharmacy deploys from `apps/pharmacy/vercel.json` → `synapse-pharm`.
- Details: `docs/deploy.md`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `npm run start --workspace @synapse/app` missing | Run `npm install` from root so `apps/app` is linked |
| Wrong Node version | `nvm install 22 && nvm use` |
| Supabase env undefined in Next | Use `NEXT_PUBLIC_*` in `.env.local`, not `VITE_*` |
| Pharmacy build OOM | Build already sets `NODE_OPTIONS=--max-old-space-size=4096` in Vercel config |
| Mobile `type-check` ReactNode errors | Expo pins React 18 while web uses React 19; dual `@types/react` can conflict under one root install. Prefer running Expo via `npm run start --workspace @synapse/app`. Full mobile type cleanup is out of scope until after CARE PLUS. |

## Out of scope for day-one setup

Hospital module shells, mobile feature expansion, and new shared packages — product priority is Synapse Pharm until first CARE PLUS sale. Keep local focus on web APIs that pharmacy/mobile already call.
