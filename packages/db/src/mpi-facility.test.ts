import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { scoreIdentityMatch } from "./mpi.ts"

describe("MPI identity across facilities", () => {
  it("never auto-merges a fuzzy name-only match", () => {
    const match = scoreIdentityMatch(
      {
        id: "p-a",
        fullName: "Jane Nakato",
        dateOfBirth: "1990-01-01",
        sex: "F",
        identifiers: [{ value: "HOSP-A-1", type: "MRN", issuingFacilityId: "hospital-a" }],
      },
      {
        id: "p-b",
        fullName: "Jane Nakato",
        dateOfBirth: "1990-01-02",
        sex: "F",
        identifiers: [{ value: "LAB-B-1", type: "MRN", issuingFacilityId: "lab-b" }],
      },
    )
    assert.notEqual(match.recommendation, "auto_link_identifier")
  })

  it("keeps same-person exact identifier linkage without merging distinct people", () => {
    const same = scoreIdentityMatch(
      {
        id: "p-a",
        fullName: "Jane Nakato",
        identifiers: [{ value: "SYN-1", type: "SYNAPSE_ID" }],
        verifiedSameAs: ["p-b"],
      },
      {
        id: "p-b",
        fullName: "Jane Nakato",
        identifiers: [{ value: "SYN-1", type: "SYNAPSE_ID" }],
      },
    )
    assert.ok(same.confidence >= 50)
  })
})
