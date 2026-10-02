// OFFLINE POS = NOT IMPLEMENTED. Pharmacy surfaces must not claim offline selling.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const FALSE_CLAIMS = /offline support|works offline|offline mode|offline-first pos|offline-capable/i

test("pharmacy manifest, POS, landing trust copy and provisioning catalog make no offline-selling claim", () => {
  for (const p of [
    "apps/pharmacy/public/manifest.json",
    "apps/pharmacy/app/portal/pos/page.tsx",
    "apps/web/src/app/page.tsx",
    "apps/web/src/app/platform/pharmacies/onboard/page.tsx",
    "apps/web/src/components/landing/FeatureTabs.tsx",
  ]) assert.doesNotMatch(read(p), FALSE_CLAIMS, p)
})

test("the offline POS module is labelled unavailable and off by default for new pharmacies", () => {
  const src = read("packages/db/src/facility-provision-catalog.ts")
  assert.match(src, /key: "offline_first_pos", label: "Offline POS \(not available yet\)", defaultEnabled: false/)
})

test("the POS still refuses to complete a sale offline", () => {
  assert.match(read("apps/pharmacy/app/portal/pos/page.tsx"), /Sales cannot be completed offline/)
})
