# Hospital closeout golden (billing → disposition → close) — 2026-09-11

## Scope
RC1 closeout coherence: outstanding invoice blocks close → payment clears billing gate → missing disposition still blocks → disposition recorded allows close.

## Layers
1. **Domain** — `evaluateEncounterCloseGate` now requires `disposition`; `runHospitalCloseoutGoldenJourney` walks the sequence.
2. **HTTP** — close route passes `encounter.disposition`; disposition + payment routes already existed.
3. **UI** — `/encounter/[id]/disposition` + hub link.
4. **Evidence** — `npm run test:hospital-closeout-golden`.

## Not yet proven
- Live synthetic invoice payment + disposition + close against production Supabase.
- Single end-to-end Hospital Golden Journey runner covering reception → write-up → orders → pharmacy → this closeout.
