import { describe, expect, it } from "vitest"
import {
  INTELLIGENCE_FORBIDDEN_ACTIONS,
  assertNotForbidden,
  authorizePacketTenant,
  assertCallerCannotSupplyTenant,
  buildRecommendation,
  recordClinicianDecision,
} from "./kernel"

describe("intelligence kernel safety", () => {
  it("forbids signing, lab release, dispensing, claims, death acts, and pathway execution", () => {
    for (const action of INTELLIGENCE_FORBIDDEN_ACTIONS) {
      expect(() => assertNotForbidden(action)).toThrow(/INTELLIGENCE_FORBIDDEN/)
    }
    expect(() => assertNotForbidden("summarize_encounter")).not.toThrow()
  })

  it("requires a clinician reason for MODIFY and REJECT", () => {
    expect(() => recordClinicianDecision({
      recommendationId: "rec-1",
      decision: "REJECT",
      clinicianId: "doctor-demo",
    })).toThrow(/CLINICIAN_REASON_REQUIRED/)
    const accepted = recordClinicianDecision({
      recommendationId: "rec-1",
      decision: "ACCEPT",
      clinicianId: "doctor-demo",
    })
    expect(accepted.decision).toBe("ACCEPT")
  })

  it("binds packets to the authenticated tenant and rejects caller-supplied tenant IDs", () => {
    expect(() => authorizePacketTenant({
      patientId: "demo-person-amina",
      tenantId: "demo-hospital",
      clinicianId: "doctor-demo",
      presentingComplaint: "fever",
    }, "demo-hospital")).not.toThrow()
    expect(() => authorizePacketTenant({
      patientId: "demo-person-amina",
      tenantId: "other-tenant",
      clinicianId: "doctor-demo",
      presentingComplaint: "fever",
    }, "demo-hospital")).toThrow(/TENANT_MISMATCH/)
    expect(() => assertCallerCannotSupplyTenant("tenant-b", "demo-hospital")).toThrow(/CALLER_TENANT_REJECTED/)
  })

  it("does not treat a recommendation as a signed diagnosis", () => {
    const rec = buildRecommendation({
      id: "rec-1",
      task: "clinical_copilot",
      proposal: { conditionName: "malaria", cantMiss: true, confidence: 0.7, aiReasoning: "Fever in an endemic setting." },
      packet: {
        patientId: "demo-person-amina",
        tenantId: "demo-hospital",
        clinicianId: "doctor-demo",
        presentingComplaint: "Fever and headache",
        laboratory: [{ test: "WBC", value: "17.6", flag: "H" }],
      },
      model: "synthetic-fallback",
    })
    expect(rec.provenance.model).toBe("synthetic-fallback")
    expect(rec.cannotMiss).toBe(true)
    expect(rec.icd11Candidates.length).toBeGreaterThan(0)
  })
})
