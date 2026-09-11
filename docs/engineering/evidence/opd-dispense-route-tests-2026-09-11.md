# OPD prescribe + hospital dispense route tests (2026-09-11)

## Scope
Mocked HTTP route coverage for:

- `POST /api/opd/prescriptions`
- `POST /api/hospital/pharmacy/dispense`

## How to run
```bash
npx vitest run apps/web/src/app/api/opd/prescriptions/route.test.ts apps/web/src/app/api/hospital/pharmacy/dispense/route.test.ts
```

Also included in `npm run test:control-plane` / CI verify.

## Assertions covered
- Auth denial before DB work
- Capability gates (`prescription.create`, `prescription.dispense`, `prescription.verify`)
- Invalid body → 400
- Missing encounter / prescription → 404
- Patient/encounter mismatch → 400
- Already dispensed → 409
- Insufficient stock → 400 (`INSUFFICIENT_STOCK`) before sale RPC
- Happy-path prescribe → 201 with correlation id + pharmacy task
- Happy-path dispense → 200 with stock decrement + idempotent sale key

## Follow-ups
- Live synthetic tenant HTTP journey against pilot hospital/pharmacy pair
- Live MFA TOTP step-up for platform admin destructive actions
