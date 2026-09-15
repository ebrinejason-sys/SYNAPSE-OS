import { describe, expect, it } from "vitest"
import { getHospitalPilotRc1Pulse, parseEvidenceFrontmatter } from "./rc1-pulse"

describe("rc1-pulse", () => {
  it("parses evidence frontmatter", () => {
    const meta = parseEvidenceFrontmatter(`---
result: PASS
environment: disposable-rc1
sha: abcdef1
scope: lab-replacement-sql
recordedAt: 2026-09-13T08:00:00.000Z
---
body`)
    expect(meta.result).toBe("PASS")
    expect(meta.environment).toBe("disposable-rc1")
  })

  it("does not mark live PASS from file presence alone", () => {
    const body = "# no frontmatter\nPASS claimed in prose"
    const pulse = getHospitalPilotRc1Pulse((path) => path.endsWith("mfa-step-up-live-2026-09-12.md"), {
      readImpl: () => body,
      expectedSha: "090ae64",
    })
    const mfa = pulse.gates.find((g) => g.id === "mfa")
    expect(mfa?.status).toBe("UNVERIFIED")
    expect(pulse.livePassed).toBe(0)
  })

  it("marks live PASS only with valid metadata matching sha", () => {
    const body = `---
result: PASS
environment: pilot-supabase
sha: 090ae645d57c
scope: mfa-step-up-live
recordedAt: 2026-09-13T08:00:00.000Z
---
ok`
    const pulse = getHospitalPilotRc1Pulse((path) => path.endsWith("mfa-step-up-live-2026-09-12.md"), {
      readImpl: () => body,
      expectedSha: "090ae645d57c671b5c11f5913d015cc524bf4009",
    })
    const mfa = pulse.gates.find((g) => g.id === "mfa")
    expect(mfa?.status).toBe("PASS")
    expect(pulse.livePassed).toBe(1)
  })

  it("domain evidence still PASSes without live frontmatter", () => {
    const pulse = getHospitalPilotRc1Pulse((path) => path.includes("lab-golden"), {
      readImpl: () => "domain only",
    })
    const lab = pulse.gates.find((g) => g.id === "lab_golden")
    expect(lab?.status).toBe("PASS")
    expect(lab?.proofKind).toBe("domain")
  })
})
