# Pharmacy polish cut — calculators + fail-closed safety + POS UX

**Date:** 2026-08-03

## Shipped

### Safety (P0 fail-open fixed)
- `POST /api/pharmacy/interactions` never returns `safe: true` on missing AI / errors.
- Deterministic pack `synapse-ddi-pack-2026.08.1` evaluated first.
- Generative path (if configured) is **advisory only** with `safe: false` / `verdict: advisory_only`.
- Mobile: `POST /api/mobile/pharmacy/interactions` (pack only).
- Web UI copy updated (no “all clear” green on unknown).

### Calculators (deterministic)
- Expo `/tools` hub → `/tools/calculators`
- BMI, IBW hint, Cockcroft–Gault CrCl, CKD-EPI eGFR, mg/kg dose, drip rate
- Pack version `synapse-calc-2026.08.1` shown in UI

### Ops polish
- POS receipt card: amount, low-stock after sale, links to sales / tools
- Complete-sale returns `lowStock[]`
- Home quick action: **Calculators & safety** → `/tools` (billing remains on Profile)

## Not in this cut
- Full validated formulary / OpenFDA sync
- AI “explain this pack hit” assistant
- Supervisor discount UI

## Deploy
- Web READY: `dpl_4Q5ZpmaL4u5dEGhfWXxhuaAiyAzJ` → https://app.synapseos.tech
- EAS APK: https://expo.dev/accounts/ebrinejason/projects/synapse-app/builds/98ed2132-5f0b-40f7-8aaa-a1c92292e4a4
- Git: no commit
