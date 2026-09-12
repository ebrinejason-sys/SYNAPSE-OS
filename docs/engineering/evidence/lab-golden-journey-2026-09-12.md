# Lab golden journey — 2026-09-12

## Scope
Domain Lab RC1 depth beside existing `LabWorkflow`, `lab-report`, hospital golden optional lab branch, and `/api/lab/*`.

Proves scorecard blockers without a parallel lab stack:

1. Specimen path: order → collect → receive → **reject (hemolyzed)**
2. Recollect as **replacement order** (REJECTED is terminal in LabWorkflow)
3. Result → human verify → release
4. **TAT** order→release (and collect/receive→release) via `measureLabTatMs`
5. Printable **FINAL** report (`buildLabReportArtifact`)
6. **Amend** retains previous value / bumps version; printable **AMENDED** report with distinct content hash
7. Safety: `LAB_RESULT_LOCKED` on overwrite; `LAB_AI_CANNOT_VERIFY`

## Proofs
- Domain: `packages/db/src/lab-golden-journey.ts` + `lab-golden-journey.test.ts` — PASS (2/2)
- LIVE_PROOF: not claimed (no live Supabase lab TAT journey in this slice)

## Run
```bash
npm run test:lab-golden-journey
```

## Notes
- Hospital Golden Journey `includeLab` still covers order→release + close-gate LAB/DOCTOR_REVIEW blocks.
- Next depth candidates: live specimen/TAT journey against pilot, Lab Edge → cloud acceptance, FHIR released-result auth.
