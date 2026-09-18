import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { resolveServicePrice } from "./clinical-charge.ts"

function catalogDb(rows: Array<{ tenant_id: string; service_type: string; name: string; price: number; is_active: boolean }>) {
  return {
    from(table: string) {
      const self: Record<string, unknown> = {}
      const chain = () => self
      let filtered = rows
      self.select = chain
      self.eq = (col: string, value: unknown) => {
        filtered = filtered.filter((row) => (row as Record<string, unknown>)[col] === value)
        return self
      }
      self.ilike = (col: string, value: string) => {
        const needle = value.replaceAll("%", "").toLowerCase()
        filtered = filtered.filter((row) => String((row as Record<string, unknown>)[col] ?? "").toLowerCase().includes(needle))
        return self
      }
      self.order = chain
      self.limit = chain
      self.maybeSingle = async () => ({ data: filtered[0] ?? null, error: null })
      return self
    },
  }
}

describe("server-authoritative service prices", () => {
  it("uses catalog price and ignores a client-supplied total", async () => {
    const db = catalogDb([
      { tenant_id: "t1", service_type: "consultation", name: "OPD consult", price: 15000, is_active: true },
    ])
    const clientAttempt = 1
    const server = await resolveServicePrice(db, "t1", "consultation", "consult")
    assert.equal(server, 15000)
    assert.notEqual(server, clientAttempt)
  })

  it("does not leak tenant B prices into tenant A", async () => {
    const db = catalogDb([
      { tenant_id: "tB", service_type: "lab", name: "FBC", price: 99, is_active: true },
    ])
    const price = await resolveServicePrice(db, "tA", "lab", "FBC")
    assert.equal(price, 15000)
  })
})
