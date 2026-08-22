import { describe, expect, it } from "vitest"
import { canMutatePharmacyInventory } from "@synapse/auth"

describe("mobile inventory mutator roles", () => {
  it("allows pharmacist and inventory-adjacent roles to mutate stock", () => {
    expect(canMutatePharmacyInventory("pharmacist")).toBe(true)
    expect(canMutatePharmacyInventory("pharmacy_admin")).toBe(true)
    expect(canMutatePharmacyInventory("pharmacy_store_manager")).toBe(true)
    expect(canMutatePharmacyInventory("pharmacy_staff")).toBe(true)
  })

  it("does not treat cashier presence of tenant_id as inventory write permission", () => {
    expect(canMutatePharmacyInventory("cashier")).toBe(false)
    expect(canMutatePharmacyInventory("pharmacy_cashier")).toBe(false)
    expect(canMutatePharmacyInventory("")).toBe(false)
  })
})
