# Admin SHA alignment — 2026-09-12

## Goal
Platform Admin shows real release status: **GitHub main → Vercel production → process SHA → remote migration ledger head** (never fake green).

## Landed
- Pure helpers: `apps/web/src/lib/platform/sha-alignment.ts` (+ Vitest 6/6)
- `getProductionTruth()` now builds `releaseAlignment`, `repoMigration`, `remoteMigration`
- Primary `shaComparison` is **GitHub ↔ Vercel production** (was incorrectly process-only)
- Deployments page + platform overview cards + health `lastMigration` probe updated
- Migration RPC `public.synapse_remote_migration_head()` applied to pilot (`20260912220000`)

## Proof
```bash
npm run test:sha-alignment
npx supabase db query --linked "select * from public.synapse_remote_migration_head();"
```

Remote head after apply: `20260912220000` (`synapse_remote_migration_head`).
