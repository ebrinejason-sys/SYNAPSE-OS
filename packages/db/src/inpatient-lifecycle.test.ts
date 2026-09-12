import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  admitPatient,
  canTransitionInpatient,
  dischargePatient,
  transferPatient,
} from "./inpatient-lifecycle.ts"

describe("inpatient-lifecycle", () => {
  it("admits then transfers then discharges", () => {
    const stay = admitPatient({
      tenantId: "t",
      hospitalId: "h",
      patientId: "p",
      encounterId: "e",
      ward: "Medical",
      bedId: "B-1",
      reason: "severe malaria",
      admittedBy: "doc",
      isSynthetic: true,
    })
    assert.equal(stay.status, "ADMITTED")
    const moved = transferPatient(stay, {
      ward: "ICU",
      bedId: "ICU-2",
      transferredBy: "nurse",
    })
    assert.equal(moved.status, "TRANSFERRED")
    assert.equal(moved.ward, "ICU")
    const out = dischargePatient(moved, {
      dischargedBy: "doc",
      dischargeDisposition: "HOME",
    })
    assert.equal(out.status, "DISCHARGED")
    assert.equal(out.dischargeDisposition, "HOME")
  })

  it("refuses discharge after discharge and same-bed transfer", () => {
    const stay = admitPatient({
      tenantId: "t",
      hospitalId: "h",
      patientId: "p",
      ward: "Medical",
      bedId: "B-1",
      reason: "obs",
      admittedBy: "doc",
    })
    assert.throws(
      () => transferPatient(stay, { ward: "Medical", bedId: "B-1", transferredBy: "n" }),
      /SAME_WARD/,
    )
    const out = dischargePatient(stay, { dischargedBy: "doc", dischargeDisposition: "HOME" })
    assert.throws(
      () => dischargePatient(out, { dischargedBy: "doc", dischargeDisposition: "HOME" }),
      /ALREADY_DISCHARGED/,
    )
    assert.equal(canTransitionInpatient("DISCHARGED", "ADMITTED"), false)
  })
})
