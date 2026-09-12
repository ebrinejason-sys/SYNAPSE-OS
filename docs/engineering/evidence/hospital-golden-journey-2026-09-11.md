# Hospital Golden Journey (RC1 domain runner) — 2026-09-11

## Scope
One domain runner covering Reception → Nurse triage → Doctor write-up → Sign → Prescribe → Verify → Dispense → Billing/Disposition closeout.

## Layers
1. **Domain** — `runHospitalGoldenJourney` in `@synapse/db/hospital-golden-journey`
2. **HTTP** — covered by prior route tests (write-up, prescribe, dispense, pay, disposition, close)
3. **Live synthetic** — not yet; next proof after this lands
4. **Evidence** — this file + `npm run test:hospital-golden-journey`

## How to run
```bash
npm run test:hospital-golden-journey
```

## What it proves
- Correlated encounter id across reception → pharmacy
- Complete structured write-up + assembled clinical note
- Encounter sign event
- Stock decrement after dispense
- Close gate sequence: BILLING block → DISPOSITION block → close allowed after paid + disposition

## What it does not prove
- Live Supabase / Vercel production path
- Lab order → result → review branch inside the same runner
- UI click-through of every hub page
