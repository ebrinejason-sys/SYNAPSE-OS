import { describe, expect, it } from "vitest"
import { getHospitalPilotRc1Pulse } from "./rc1-pulse"

describe("rc1-pulse", () => {
  it("marks gates PASS only when evidence files exist", () => {
    const pulse = getHospitalPilotRc1Pulse((path) => path.endsWith("mfa-step-up-live-2026-09-12.md"))
    expect(pulse.passed).toBe(1)
    expect(pulse.total).toBeGreaterThan(1)
    expect(pulse.status).toBe("INCOMPLETE")
    const mfa = pulse.gates.find((g) => g.id === "mfa")
    expect(mfa?.status).toBe("PASS")
    const triage = pulse.gates.find((g) => g.id === "offline_triage")
    expect(triage?.status).toBe("MISSING")
  })

  it("becomes PILOT_READY when every gate exists", () => {
    const pulse = getHospitalPilotRc1Pulse(() => true)
    expect(pulse.status).toBe("PILOT_READY")
    expect(pulse.passed).toBe(pulse.total)
  })
})
