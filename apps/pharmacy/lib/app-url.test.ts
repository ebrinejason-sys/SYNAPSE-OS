import { afterEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { pharmacyAppUrl, pharmacyUrl, PHARMACY_APP_URL_FALLBACK } from "./app-url"

afterEach(() => vi.unstubAllEnvs())

describe("pharmacyAppUrl", () => {
  it("uses NEXT_PUBLIC_PHARMACY_APP_URL without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_PHARMACY_APP_URL", "https://pharm.synapseos.tech/")
    expect(pharmacyAppUrl()).toBe("https://pharm.synapseos.tech")
  })
  it("never falls back to NEXT_PUBLIC_APP_URL (the apex 404s /reset-password/<token>)", () => {
    vi.stubEnv("NEXT_PUBLIC_PHARMACY_APP_URL", "")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://synapseos.tech")
    expect(pharmacyAppUrl()).toBe(PHARMACY_APP_URL_FALLBACK)
  })
  it.each(["https://synapseos.tech", "https://www.synapseos.tech", "not a url", "ftp://pharm.synapseos.tech", "http://pharm.synapseos.tech"])(
    "rejects unsafe value %s",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_PHARMACY_APP_URL", value)
      expect(pharmacyAppUrl()).toBe(PHARMACY_APP_URL_FALLBACK)
    },
  )
  it("allows http only for localhost development", () => {
    vi.stubEnv("NEXT_PUBLIC_PHARMACY_APP_URL", "http://pharm.localhost:3002")
    expect(pharmacyAppUrl()).toBe("http://pharm.localhost:3002")
  })
  it("builds paths", () => {
    vi.stubEnv("NEXT_PUBLIC_PHARMACY_APP_URL", "https://pharm.synapseos.tech")
    expect(pharmacyUrl("/reset-password/abc")).toBe("https://pharm.synapseos.tech/reset-password/abc")
    expect(pharmacyUrl("portal/orders")).toBe("https://pharm.synapseos.tech/portal/orders")
  })
})

describe("pharmacy email links never use NEXT_PUBLIC_APP_URL", () => {
  it.each([
    "lib/email.ts",
    "app/api/auth/forgot-password/route.ts",
    "app/api/admin/inquiries/route.ts",
    "app/api/customer/orders/route.ts",
    "app/api/admin/orders/claim/route.ts",
    "app/api/admin/users/route.ts",
    "app/api/auth/register/route.ts",
  ])("%s", (file) => {
    const src = readFileSync(join(__dirname, "..", file), "utf8")
    expect(src).not.toMatch(/NEXT_PUBLIC_APP_URL/)
  })
})
