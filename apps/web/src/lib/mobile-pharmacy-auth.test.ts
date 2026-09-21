import { describe, expect, it } from "vitest"
import {
  canWriteMobilePharmacyInventory,
  isMobilePharmacyAdmin,
  mobileHasPharmacyCapability,
  type MobileAuth,
} from "./mobile-pharmacy-auth"

function auth(role: string): MobileAuth {
  return { userId: "u1", tenantId: "tenant-a", role, token: "t" }
}

describe("mobile pharmacy capability authority", () => {
  it("lets pharmacists and inventory officers manage purchasing", () => {
    expect(mobileHasPharmacyCapability(auth("pharmacist"), "purchasing.manage")).toBe(true)
    expect(mobileHasPharmacyCapability(auth("inventory_officer"), "purchasing.manage")).toBe(true)
    expect(mobileHasPharmacyCapability(auth("pharmacy_admin"), "purchasing.manage")).toBe(true)
  })

  it("denies cashiers purchasing and inventory writes", () => {
    expect(mobileHasPharmacyCapability(auth("pharmacy_cashier"), "purchasing.manage")).toBe(false)
    expect(mobileHasPharmacyCapability(auth("cashier"), "purchasing.manage")).toBe(false)
    expect(canWriteMobilePharmacyInventory(auth("pharmacy_cashier"))).toBe(false)
  })

  it("does not treat cashier as pharmacy admin", () => {
    expect(isMobilePharmacyAdmin(auth("pharmacist"))).toBe(true)
    expect(isMobilePharmacyAdmin(auth("pharmacy_cashier"))).toBe(false)
  })
})
