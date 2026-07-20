# Deploy gate — avoid broken production deploys

## Vercel projects (same GitHub repo)

| Project | Root directory | Production URL | Build |
|---------|----------------|----------------|-------|
| `synpase-os` | `.` (repo root) | **synapseos.tech** (landing) + app.synapseos.tech + admin.synapseos.tech | `vercel.json` at root |
| `synapse-demo` | `.` | demo.synapseos.tech | same root `vercel.json` |
| `synapse-pharm` | `apps/pharmacy` | pharm.synapseos.tech | `apps/pharmacy/vercel.json` |

**Domain setup (required):** In Vercel → `synpase-os` → Settings → Domains, add:
- `synapseos.tech` (apex — marketing landing)
- `www.synapseos.tech` (redirect to apex)
- `app.synapseos.tech` (consumer health portal)
- `admin.synapseos.tech` (platform console)

All subdomains point to the **same** `synpase-os` deployment; middleware routes by host.

All three deploy on push to `main` via Vercel Git integration.

## Build gate (automatic)

Each `vercel.json` includes `ignoreCommand` that runs **before** Vercel builds:

```json
"ignoreCommand": "node scripts/vercel-build-gate.mjs web"
```

- Exit **1** → verify passed → build continues  
- Exit **0** → verify failed → deploy **canceled** (no broken production)

Pharmacy uses `node ../../scripts/vercel-build-gate.mjs pharmacy`.

This is enforced from the repo — no dashboard click required after push.

## Sync dashboard settings (optional)

Dashboard may still show stale values (e.g. an old Vite `build:demo` command). Repo `vercel.json` overrides on deploy, but to align the dashboard:

1. Create a token at https://vercel.com/account/tokens  
2. Run:

```bash
VERCEL_TOKEN=xxx npm run vercel:sync
```

This runs `scripts/sync-vercel-projects.mjs` and sets build/output/ignore/node version for all three projects.

## Local linking (monorepo)

```bash
# Web (synpase-os) — from repo root
npx vercel link --project synpase-os

# Pharmacy — from apps/pharmacy
cd apps/pharmacy && npx vercel link --project synapse-pharm

# Demo shares root with synpase-os; link when deploying demo explicitly
npx vercel link --project synapse-demo
```

`.vercel/repo.json` maps all three for `vercel link --repo` (local only, gitignored).

## Before pushing to `main`

```bash
npm ci
npm run verify:web
npm run build --workspace @synapse/pharmacy   # if pharmacy changed
```

Only push when both pass.

## CI vs Vercel Git

- **GitHub Actions `verify`** — runs on every push/PR  
- **Vercel Git** — deploys on push; now gated by `ignoreCommand`  
- **`deploy-vercel` job** — optional CLI deploy after verify (needs `VERCEL_TOKEN` secret)

Recommended: require GitHub **`verify`** check on `main` branch protection.

## Build commands (source of truth)

| App | Command |
|-----|---------|
| Web | `node scripts/sync-web-public.mjs && npm run build --workspace @synapse/web` |
| Pharmacy | `cd ../.. && NODE_OPTIONS=--max-old-space-size=4096 npm run build --workspace @synapse/pharmacy` |

## Manual production deploy (CLI, after verify)

```bash
npm ci && npm run verify:web
npx vercel pull --yes --environment=production   # synpase-os linked at root
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```

Pharmacy: run from `apps/pharmacy` with that project linked.
