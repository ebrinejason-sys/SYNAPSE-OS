# Legacy Vite demo (quarantined)

This folder holds the old root Vite + React Router demo previously at `/src`.

**It is not part of the monorepo workspaces and is not deployed.**

Active apps live under `apps/`:

| App | Path | Port |
|-----|------|------|
| Web platform | `apps/web` | 3001 |
| Synapse Pharm | `apps/pharmacy` | 3002 |
| Mobile (Expo) | `apps/app` | Expo |

To run this legacy demo locally (optional):

```bash
cd legacy/vite-demo
npm install
npm run dev
```

Do not add features here. Prefer `apps/web` `/demo` routes for public sandbox work.
