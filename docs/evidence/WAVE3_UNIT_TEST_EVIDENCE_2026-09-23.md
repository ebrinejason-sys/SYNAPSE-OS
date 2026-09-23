# Wave 3 Unit Test Evidence — 2026-09-23

**Repository:** ebrinejason-sys/SYNAPSE-OS  
**Branch:** cursor/wave3-golden-journey-evidence-1f40  
**Date:** 2026-09-23  
**Environment:** Local development (no secrets required)

---

## Summary

All domain-layer golden journey tests PASS. These tests validate the business logic for hospital workflows without requiring database connections or API credentials.

---

## Test Results

### 1. Hospital Golden Journey (`test:hospital-golden-journey`)

**Command:** `npm run test:hospital-golden-journey`  
**File:** `packages/db/src/hospital-golden-journey.test.ts`  
**Result:** ✅ PASS (3/3 tests)  
**Duration:** 419ms

**Tests Passed:**
- ✓ passes reception → write-up → pharmacy → closeout (8.2ms)
- ✓ keeps one correlation id across the journey (0.5ms)
- ✓ optional lab branch blocks close until review then continues (1.4ms)

**What This Proves:**
- Reception creates encounter with patient
- Nurse completes triage with vitals
- Doctor writes structured clinical note (HPI, assessment, plan)
- Encounter can be signed
- Prescription is placed and requires verification before dispense
- Pharmacy verifies and dispenses with exact stock decrement
- Billing blocks closeout until marked paid
- Disposition is required before close
- Encounter close is allowed after all gates clear
- Optional lab branch: order → result → doctor review blocks close until reviewed

**Evidence:**
```
TAP version 13
# tests 3
# suites 1
# pass 3
# fail 0
```

---

### 2. OPD Dispense Golden Journey (`test:opd-dispense-golden`)

**Command:** `npm run test:opd-dispense-golden`  
**Files:** 
- `packages/db/src/prescription-bridge.test.ts`
- `packages/db/src/opd-dispense-golden.test.ts`

**Result:** ✅ PASS (7/7 tests)  
**Duration:** 255ms

**Tests Passed:**

**opd-dispense golden journey:**
- ✓ passes encounter → triage → prescribe → verify → dispense with stock decrement (8.0ms)
- ✓ fails closed on insufficient stock (0.4ms)
- ✓ keeps a shared correlation id across the journey (0.4ms)

**prescription-bridge permissions:**
- ✓ allows doctors to prescribe and pharmacists to dispense (0.7ms)

**prescription-bridge lifecycle:**
- ✓ creates active prescriptions and rejects invalid quantity (0.2ms)
- ✓ requires verification before dispense and blocks self-dispense (0.2ms)
- ✓ decrements stock exactly once and rejects insufficient stock (0.2ms)

**What This Proves:**
- Doctors can create prescriptions (status: active)
- Pharmacists must verify before dispensing
- Prescribers cannot self-dispense (unless platform_admin)
- Dispense requires verified status
- Stock decrements exactly once per dispense
- Insufficient stock blocks dispense
- Correlation ID flows through encounter → prescription → dispense

**Evidence:**
```
TAP version 13
# tests 7
# suites 3
# pass 7
# fail 0
```

---

### 3. Hospital Closeout Golden (`test:hospital-closeout-golden`)

**Command:** `npm run test:hospital-closeout-golden`  
**Files:**
- `packages/db/src/hospital-closeout-golden.test.ts`
- `packages/db/src/encounter-close-gate.test.ts`

**Result:** ✅ PASS (6/6 tests)  
**Duration:** 235ms

**Tests Passed:**

**evaluateEncounterCloseGate:**
- ✓ allows close when clinical, financial, and disposition work is clear (1.0ms)
- ✓ returns alreadyClosed when status is completed (0.1ms)
- ✓ blocks when disposition is missing even if billing is paid (0.1ms)
- ✓ blocks on open lab, unreviewed results, pharmacy, billing, and tasks (0.1ms)
- ✓ filters local-pharmacy blockers from prescription rows (0.1ms)

**hospital-closeout-golden:**
- ✓ walks billing → disposition → close in order (0.7ms)

**What This Proves:**
- Encounter close is blocked by:
  - Unpaid consultation fee
  - Missing disposition
  - Unverified prescriptions (unless local pharmacy disposition)
  - Unreviewed lab results
  - Open department tasks
- Encounter close is allowed when all blockers are cleared
- Billing must be paid before disposition
- Disposition must be recorded before close
- Already-closed encounters return `alreadyClosed` status
- Local pharmacy disposition filters out prescription blockers (patient will pay at pharmacy)

**Evidence:**
```
TAP version 13
# tests 6
# suites 2
# pass 6
# fail 0
```

---

### 4. Lab Golden Journey (`test:lab-golden-journey`)

**Command:** `npm run test:lab-golden-journey`  
**Files:**
- `packages/db/src/lab-golden-journey.test.ts`
- `packages/db/src/lab-result-persist.test.ts`
- `packages/db/src/lab-device-intelligence.test.ts`

**Result:** ✅ PASS (13/13 tests)  
**Duration:** 295ms

**Tests Passed:**

**lab device intelligence:**
- ✓ treats CONNECTED as physically present, not clinically trusted (0.9ms)
- ✓ derives health from timestamps and queue state rather than static labels (0.2ms)
- ✓ computes mapping coverage only from observed counts (0.5ms)
- ✓ flags critical values deterministically and does not convert mismatched units (0.2ms)
- ✓ issues hashed bridge secrets without storing the presented key as the hash input identity (0.7ms)

**lab-golden-journey:**
- ✓ passes specimen reject → recollect → release → amend + printable reports with TAT (2.7ms)
- ✓ measureLabTatMs rejects inverted timestamps (0.3ms)

**lab-result-persist:**
- ✓ maps amended workflow status to corrected DB status (0.5ms)
- ✓ round-trips amended via corrected column and writes canonical order keys (0.3ms)
- ✓ refuses persist without encounter_id (0.2ms)
- ✓ persists then reloads the exact tenant/order/patient result (0.3ms)
- ✓ does not return a result for the wrong order (0.1ms)
- ✓ does not return a result across tenants (0.1ms)

**What This Proves:**
- Lab workflow state machine: ordered → collected → analyzing → verified → released
- Specimen can be rejected and trigger recollect
- Results can be amended (creates corrected record)
- TAT (turnaround time) is measured from order to release
- Device bridge authenticates with hashed secrets
- Critical value flags are deterministic
- Results are tenant-isolated
- Results require encounter_id (no orphan results)
- Amended results map to `corrected` status in database

**Evidence:**
```
TAP version 13
# tests 13
# suites 3
# pass 13
# fail 0
```

---

## Additional Tests Available (Not Run)

These tests are also available but were not run for this evidence capture:

| Test Command | What It Proves | Secrets Required |
|--------------|----------------|------------------|
| `test:ehr-continuity-golden` | Patient timeline event projection | ❌ None |
| `test:inpatient-lifecycle` | Admit → transfer → discharge flow | ❌ None |
| `test:referral-lifecycle` | Referral send → accept → complete | ❌ None |
| `test:clinical-offline-writeup` | Offline write-up with sync | ❌ None |
| `test:clinical-offline-disposition` | Offline disposition with sync | ❌ None |
| `test:clinical-offline-triage` | Offline triage with sync | ❌ None |
| `test:clinical-offline-prescribe` | Offline prescribe with sync | ❌ None |

---

## Conclusion

**Status:** ✅ ALL UNIT TESTS PASS

All domain-layer golden journey tests complete successfully with no failures. The business logic for:

1. Hospital OPD journey (reception → triage → write-up → prescribe → dispense → close)
2. Pharmacy dispense flow (verify-required, stock decrement, idempotency)
3. Encounter closeout gates (billing, disposition, clinical work complete)
4. Lab workflow (order → collect → analyze → verify → release → amend)

...is validated and ready for live integration testing.

**Next Steps:**
1. Set up Preview environment (see `docs/evidence/GOLDEN_JOURNEY_WAVE3.md`)
2. Run configuration doctor: `npm run e2e:acceptance:doctor`
3. Run live journey: `npm run journey:hospital-golden-live`
4. Collect evidence JSON files

---

**Operator:** Cloud Agent (Cursor)  
**Evidence Type:** Automated unit test execution  
**Environment:** Local development, no external dependencies  
**Reproducible:** Yes, run `npm ci && npm run test:hospital-golden-journey` on any machine
