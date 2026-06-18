# Deploy gate — avoid broken production deploys

## What went wrong

Vercel **Git integration** deploys on every push to `main`, **in parallel** with GitHub Actions. Broken code reached production before CI could block it (e.g. wrong import path in `mobile/login/route.ts`).

## Recommended setup

### 1. GitHub branch protection (main)

Require status check **`verify`** (from `.github/workflows/deploy.yml`) before merge.

### 2. Vercel — gate production builds

**Option A (recommended):** Vercel → Project → Settings → Git → **disable automatic Production deployments**. Deploy production only via GitHub Actions `deploy-vercel` job (runs after `verify` passes).

**Option B:** Vercel → Settings → Git → **Ignored Build Step**:

```bash
bash scripts/vercel-build-gate.sh
```

This runs `npm run verify:web` locally on Vercel; **skips** the deploy if verify fails.

### 3. Agent / developer rule

Before pushing to `main`:

```bash
npm ci
npm run verify:web
npm run build --workspace @synapse/pharmacy   # if pharmacy changed
```

Only push when both builds pass.

## Build commands (match Vercel)

| App | Command |
|-----|---------|
| Web (synapse-os) | `node scripts/sync-web-public.mjs && npm run build --workspace @synapse/web` |
| Pharmacy | `npm run build --workspace @synapse/pharmacy` |

Root `vercel.json` is the source of truth for the web app.
