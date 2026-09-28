import { describe, expect, it } from "vitest"
import { findDuplicatePatients, isLikelyDuplicate, type DuplicateCandidate } from "./patient-duplicates"

function candidate(overrides: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return { id: "p1", mrn: "MRN-1", full_name: "Amina Nakato", dob: null, sex: "F", phone: null, nin: null, ...overrides }
}

describe("isLikelyDuplicate", () => {
  it("matches the same name regardless of case and spacing", () => {
    expect(isLikelyDuplicate({ full_name: "  amina   NAKATO " }, candidate())).toBe(true)
  })

  it("does not match the same name when both dates of birth differ", () => {
    expect(isLikelyDuplicate({ full_name: "Amina Nakato", dob: "1990-01-01" }, candidate({ dob: "1985-06-02" }))).toBe(false)
  })

  it("matches the same name and date of birth", () => {
    expect(isLikelyDuplicate({ full_name: "Amina Nakato", dob: "1990-01-01" }, candidate({ dob: "1990-01-01T00:00:00Z" }))).toBe(true)
  })

  it("matches on phone or NIN even when names differ", () => {
    expect(isLikelyDuplicate({ full_name: "A. Nakato", phone: "0700000001" }, candidate({ phone: "0700000001" }))).toBe(true)
    expect(isLikelyDuplicate({ full_name: "A. Nakato", nin: "CF123" }, candidate({ nin: "CF123" }))).toBe(true)
  })

  it("does not match different names with no shared identifiers", () => {
    expect(isLikelyDuplicate({ full_name: "Brian Okello" }, candidate())).toBe(false)
  })
})

describe("findDuplicatePatients", () => {
  function fakeDb(rows: DuplicateCandidate[], calls: Array<[string, unknown]>) {
    return {
      from: () => {
        const q: Record<string, unknown> = {}
        for (const m of ["select", "eq", "limit", "ilike"]) {
          q[m] = (...args: unknown[]) => {
            calls.push([m, args])
            return q
          }
        }
        q.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null })
        return q
      },
    }
  }

  it("scopes lookups to the tenant, excludes deleted rows and escapes LIKE wildcards", async () => {
    const calls: Array<[string, unknown]> = []
    await findDuplicatePatients(fakeDb([], calls), "tenant-a", { full_name: "50%_off" })
    expect(calls).toContainEqual(["eq", ["tenant_id", "tenant-a"]])
    expect(calls).toContainEqual(["eq", ["is_deleted", false]])
    expect(calls).toContainEqual(["ilike", ["full_name", "50\\%\\_off"]])
  })

  it("de-duplicates rows returned by several lookups", async () => {
    const row = candidate({ phone: "0700000001" })
    const found = await findDuplicatePatients(fakeDb([row], []), "tenant-a", {
      full_name: "Amina Nakato",
      phone: "0700000001",
    })
    expect(found).toEqual([row])
  })
})
