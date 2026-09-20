import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..")

function src(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

describe("hospital OS data boundary", () => {
  it("does not query patients through the anon SSR client", () => {
    expect(src("apps/web/src/app/os/[slug]/patients/page.tsx")).not.toMatch(/createClient/)
    expect(src("apps/web/src/app/os/[slug]/patients/[id]/page.tsx")).not.toMatch(/createClient/)
    expect(src("apps/web/src/app/os/[slug]/dashboard/page.tsx")).not.toMatch(/createServiceClient/)
    expect(src("apps/web/src/lib/hospital-os-data.ts")).toMatch(/eq\("tenant_id", tenantId\)/)
    expect(src("apps/web/src/lib/supabase/client.ts")).not.toMatch(/SERVICE_ROLE/)
  })
})

describe("hospital BFF explicit tenant filters", () => {
  const files = [
    "apps/web/src/app/api/patients/search/route.ts",
    "apps/web/src/app/api/opd/queue/route.ts",
    "apps/web/src/app/api/nurse/ward/route.ts",
    "apps/web/src/app/api/emergency/queue/route.ts",
    "apps/web/src/app/api/opd/encounters/[id]/write-up/route.ts",
    "apps/web/src/app/api/opd/lab-orders/route.ts",
    "apps/web/src/app/api/opd/prescriptions/route.ts",
    "apps/web/src/app/api/hospital/billing/encounter/[id]/route.ts",
    "apps/web/src/app/api/hospital/pharmacy/dispense/route.ts",
    "apps/web/src/app/api/lab/orders/[id]/cancel/route.ts",
  ]

  it("scopes representative hospital healthcare queries by ctx.tenantId", () => {
    for (const file of files) {
      const text = src(file)
      expect(text, file).toMatch(/tenant_id/)
      expect(text, file).toMatch(/ctx\.tenantId/)
    }
  })

  it("does not look up patients by id alone on OPD/nurse/emergency queues", () => {
    for (const file of [
      "apps/web/src/app/api/opd/queue/route.ts",
      "apps/web/src/app/api/nurse/ward/route.ts",
      "apps/web/src/app/api/emergency/queue/route.ts",
    ]) {
      const text = src(file)
      expect(text, file).toMatch(/from\('patients'\)[\s\S]{0,180}eq\('tenant_id', ctx\.tenantId\)/)
    }
  })
})
