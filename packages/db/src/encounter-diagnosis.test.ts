import { describe, expect, it } from "vitest"
import { lookupStem, searchIcd11 } from "@synapse/interop"
import { encounterDiagnosisRow } from "./encounter-diagnosis"

describe("encounter diagnosis persistence row", () => {
  it("saves a cache hit onto the existing diagnosis columns and reloads the same code", () => {
    const hit = searchIcd11("malaria")[0]
    expect(hit?.stemCode).toBeTruthy()
    const entity = lookupStem(hit!.stemCode)
    expect(entity?.title).toMatch(/Malaria/i)

    const row = encounterDiagnosisRow({
      encounterId: "00000000-0000-4000-8000-0000000000e1",
      tenantId: "00000000-0000-4000-8000-0000000000t1",
      selectedBy: "00000000-0000-4000-8000-0000000000c1",
      stemCode: entity!.stemCode,
      title: entity!.title,
      foundationUri: entity!.foundationUri,
      linearizationUri: entity!.linearizationUri,
      release: entity!.release,
    })

    expect(row).toMatchObject({
      stem_code: entity!.stemCode,
      cluster_code: entity!.stemCode,
      title: entity!.title,
      certainty: "confirmed",
      diagnosis_type: "primary",
      suggested_by: "clinician",
    })
    expect(row).not.toHaveProperty("created_by")
    expect(lookupStem(row.stem_code)?.title).toBe(row.title)
  })

  it("rejects an invented code before a row is built", () => {
    expect(lookupStem("ZZZZ")).toBeNull()
  })
})
