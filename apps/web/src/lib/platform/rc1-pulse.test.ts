import { describe, expect, it } from "vitest"
import { getHospitalPilotRc1Pulse } from "./rc1-pulse"

describe("rc1-pulse", () => {
  it("marks gates PASS only when evidence files exist and preserves proofKind", () => {
    const pulse = getHospitalPilotRc1Pulse((path) => path.endsWith("mfa-step-up-live-2026-09-12.md"))
    expect(pulse.passed).toBe(1)
    expect(pulse.total).toBeGreaterThan(1)
    expect(pulse.status).toBe("INCOMPLETE")
    const mfa = pulse.gates.find((g) => g.id === "mfa")
    expect(mfa?.status).toBe("PASS")
    expect(mfa?.proofKind).toBe("live")
    const lab = pulse.gates.find((g) => g.id === "lab_golden")
    expect(lab?.proofKind).toBe("domain")
    expect(lab?.status).toBe("MISSING")
  })

  it("becomes PILOT_READY only when every gate including live exists", () => {
    const pulse = getHospitalPilotRc1Pulse(() => true)
    expect(pulse.status).toBe("PILOT_READY")
    expect(pulse.passed).toBe(pulse.total)
    expect(pulse.livePassed).toBe(pulse.liveTotal)
    expect(pulse.detail).toContain("live")
  })

  it("does not treat domain-only completeness as PILOT_READY", () => {
    const pulse = getHospitalPilotRc1Pulse((path) =>
      path.includes("clinical-offline") || path.includes("lab-golden") || path.includes("hospital-closeout"),
    )
    expect(pulse.passed).toBeGreaterThan(0)
    expect(pulse.status).not.toBe("PILOT_READY")
    expect(pulse.livePassed).toBe(0)
  })
})
