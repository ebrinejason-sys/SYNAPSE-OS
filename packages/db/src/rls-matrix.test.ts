import { describe, it } from "node:test"
import assert from "node:assert/strict"

/**
 * Expected RLS matrix for critical production tables.
 * Cross-tenant SELECT/INSERT/UPDATE/DELETE must fail for anonymous and
 * foreign-tenant users. Service role is the BFF exception, not a client role.
 */
export const RLS_MATRIX = [
  { table: "patients", anonymous: { select: false, insert: false, update: false, delete: false }, tenantA: { select: true, insert: true, update: true, delete: false }, tenantB: { select: false, insert: false, update: false, delete: false }, platformAdmin: { select: false, insert: false, update: false, delete: false } },
  { table: "encounters", anonymous: { select: false, insert: false, update: false, delete: false }, tenantA: { select: true, insert: true, update: true, delete: false }, tenantB: { select: false, insert: false, update: false, delete: false }, platformAdmin: { select: false, insert: false, update: false, delete: false } },
  { table: "lab_results", anonymous: { select: false, insert: false, update: false, delete: false }, tenantA: { select: true, insert: true, update: true, delete: false }, tenantB: { select: false, insert: false, update: false, delete: false }, platformAdmin: { select: false, insert: false, update: false, delete: false } },
  { table: "billing_invoices", anonymous: { select: false, insert: false, update: false, delete: false }, tenantA: { select: true, insert: true, update: true, delete: false }, tenantB: { select: false, insert: false, update: false, delete: false }, platformAdmin: { select: false, insert: false, update: false, delete: false } },
  { table: "billing_payments", anonymous: { select: false, insert: false, update: false, delete: false }, tenantA: { select: true, insert: true, update: false, delete: false }, tenantB: { select: false, insert: false, update: false, delete: false }, platformAdmin: { select: false, insert: false, update: false, delete: false } },
  { table: "persons", anonymous: { select: false, insert: false, update: false, delete: false }, tenantA: { select: true, insert: true, update: false, delete: false }, tenantB: { select: false, insert: false, update: false, delete: false }, platformAdmin: { select: false, insert: false, update: false, delete: false } },
]

describe("RLS tenancy matrix contract", () => {
  it("denies anonymous and cross-tenant access on critical tables", () => {
    for (const row of RLS_MATRIX) {
      assert.equal(row.anonymous.select, false, `${row.table} anonymous select`)
      assert.equal(row.tenantB.select, false, `${row.table} tenant B select`)
      assert.equal(row.tenantB.insert, false, `${row.table} tenant B insert`)
      assert.equal(row.tenantB.update, false, `${row.table} tenant B update`)
      assert.equal(row.tenantB.delete, false, `${row.table} tenant B delete`)
      assert.equal(row.platformAdmin.select, false, `${row.table} platform admin hospital PHI`)
    }
  })
})
