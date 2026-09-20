import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  persistableLabResultStatus,
  labResultToRow,
  rowToLabResult,
  persistLabResultBestEffort,
  loadLabResultsForOrder,
} from "./lab-result-persist.ts"
import type { LabResult } from "./lab-workflow.ts"

const TENANT_A = "0edb651a-232a-4289-9b3d-ae5bb1bac2cb"
const TENANT_B = "200dfeb5-4c09-4a5d-8d46-14aa4b78a6ec"
const ORDER = "e76497a1-3a54-4984-827c-f6c339edbf99"
const OTHER_ORDER = "ffb1e2c7-973b-45a3-b1b9-c8f44da82d72"
const PATIENT = "19bc626f-f51a-4bd5-aefd-7a4534babfeb"
const ENCOUNTER = "e6edbd38-08be-4f07-aeff-3ad268e939fe"
const RESULT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function sampleResult(overrides: Partial<LabResult> = {}): LabResult {
  return {
    id: RESULT,
    labOrderId: ORDER,
    tenantId: TENANT_A,
    patientId: PATIENT,
    loincCode: "58410-2",
    testName: "FBC",
    resultValue: "4.2",
    numericValue: 4.2,
    unit: "x10^9/L",
    referenceRange: "",
    flag: "N",
    isCritical: false,
    isAbnormal: false,
    status: "preliminary",
    version: 1,
    provenance: "SYSTEM_GENERATED",
    isSynthetic: true,
    ...overrides,
  }
}

function memoryDb(rows: Record<string, unknown>[] = []) {
  const store = rows
  return {
    store,
    from() {
      const filters: Array<[string, string]> = []
      const q = {
        select() {
          return q
        },
        eq(col: string, val: string) {
          filters.push([col, val])
          return q
        },
        upsert(row: Record<string, unknown>) {
          const idx = store.findIndex((existing) => existing.id === row.id)
          if (idx >= 0) store[idx] = { ...store[idx], ...row }
          else store.push({ ...row })
          return { error: null }
        },
        then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
          const data = store.filter((row) =>
            filters.every(([col, val]) => String(row[col]) === val),
          )
          return Promise.resolve({ data, error: null }).then(resolve)
        },
      }
      return q
    },
  }
}

describe("lab-result-persist", () => {
  it("maps amended workflow status to corrected DB status", () => {
    assert.equal(persistableLabResultStatus("amended"), "corrected")
    assert.equal(persistableLabResultStatus("final"), "final")
    assert.equal(persistableLabResultStatus("preliminary"), "preliminary")
  })

  it("round-trips amended via corrected column and writes canonical order keys", () => {
    const row = labResultToRow(sampleResult({
      resultValue: "Positive",
      numericValue: null,
      unit: "",
      referenceRange: "negative",
      flag: "A",
      isAbnormal: true,
      status: "amended",
      version: 2,
      provenance: "LAB_VERIFIED",
      isSynthetic: false,
    }), { encounterId: ENCOUNTER, enteredBy: "lab-tech" })
    assert.equal(row.status, "corrected")
    assert.equal(row.lab_order_id, ORDER)
    assert.equal(row.tenant_id, TENANT_A)
    assert.equal(row.patient_id, PATIENT)
    assert.equal(row.encounter_id, ENCOUNTER)
    assert.equal(row.value, "Positive")
    assert.equal(row.result_value, "Positive")
    const back = rowToLabResult(row)
    assert.equal(back.status, "amended")
    assert.equal(back.labOrderId, ORDER)
    assert.equal(back.resultValue, "Positive")
  })

  it("refuses persist without encounter_id", async () => {
    const db = memoryDb()
    const outcome = await persistLabResultBestEffort(db, sampleResult(), { enteredBy: "lab-tech" })
    assert.equal(outcome.ok, false)
    if (outcome.ok) throw new Error("expected persist failure")
    assert.match(outcome.error, /LAB_RESULT_ENCOUNTER_REQUIRED/)
    assert.equal(db.store.length, 0)
  })

  it("persists then reloads the exact tenant/order/patient result", async () => {
    const db = memoryDb()
    const persisted = await persistLabResultBestEffort(db, sampleResult(), {
      enteredBy: "lab-tech",
      encounterId: ENCOUNTER,
      source: "MANUAL",
    })
    assert.equal(persisted.ok, true)
    assert.equal(db.store.length, 1)
    assert.equal(db.store[0]?.lab_order_id, ORDER)
    assert.equal(db.store[0]?.tenant_id, TENANT_A)
    assert.equal(db.store[0]?.patient_id, PATIENT)
    assert.equal(db.store[0]?.encounter_id, ENCOUNTER)
    assert.equal(db.store[0]?.status, "preliminary")
    assert.equal(db.store[0]?.entered_by, "lab-tech")

    const loaded = await loadLabResultsForOrder(db, TENANT_A, ORDER)
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0]?.id, RESULT)
    assert.equal(loaded[0]?.labOrderId, ORDER)
    assert.equal(loaded[0]?.tenantId, TENANT_A)
    assert.equal(loaded[0]?.patientId, PATIENT)
    assert.equal(loaded[0]?.resultValue, "4.2")
  })

  it("does not return a result for the wrong order", async () => {
    const db = memoryDb()
    await persistLabResultBestEffort(db, sampleResult(), { encounterId: ENCOUNTER })
    const loaded = await loadLabResultsForOrder(db, TENANT_A, OTHER_ORDER)
    assert.equal(loaded.length, 0)
  })

  it("does not return a result across tenants", async () => {
    const db = memoryDb()
    await persistLabResultBestEffort(db, sampleResult(), { encounterId: ENCOUNTER })
    const loaded = await loadLabResultsForOrder(db, TENANT_B, ORDER)
    assert.equal(loaded.length, 0)
  })
})
