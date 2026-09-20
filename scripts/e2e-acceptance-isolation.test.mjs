import assert from "node:assert/strict"
import { test } from "node:test"
import {
  PRODUCTION_PROJECT_REF,
  EXPECTED_ACCEPTANCE_PROJECT_REF,
  supabaseProjectRefFromUrl,
  validateIsolatedSupabaseUrl,
  validateAcceptanceBaseUrl,
  validateServiceRoleKey,
  interpretReadyPayload,
} from "./e2e-acceptance-isolation.mjs"

function fakeJwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
  return `${header}.${payload}.sig`
}

test("extracts a supabase project ref from a project URL", () => {
  assert.equal(
    supabaseProjectRefFromUrl(`https://${EXPECTED_ACCEPTANCE_PROJECT_REF}.supabase.co`),
    EXPECTED_ACCEPTANCE_PROJECT_REF,
  )
})

test("refuses production supabase as the acceptance database", () => {
  const result = validateIsolatedSupabaseUrl(`https://${PRODUCTION_PROJECT_REF}.supabase.co`)
  assert.equal(result.status, "INVALID")
  assert.match(result.reason, /production/i)
})

test("accepts the documented isolated acceptance project URL", () => {
  const result = validateIsolatedSupabaseUrl(`https://${EXPECTED_ACCEPTANCE_PROJECT_REF}.supabase.co`)
  assert.equal(result.status, "FOUND")
  assert.equal(result.projectRef, EXPECTED_ACCEPTANCE_PROJECT_REF)
})

test("rejects localhost and production OS hosts for browser acceptance", () => {
  assert.equal(validateAcceptanceBaseUrl("http://127.0.0.1:3011").status, "INVALID")
  assert.equal(validateAcceptanceBaseUrl("https://synapseos.tech").status, "INVALID")
  assert.equal(validateAcceptanceBaseUrl("https://admin.synapseos.tech").status, "INVALID")
  assert.equal(validateAcceptanceBaseUrl("https://pharm.synapseos.tech").status, "INVALID")
  assert.equal(validateAcceptanceBaseUrl("https://demo.synapseos.tech").status, "INVALID")
  assert.equal(
    validateAcceptanceBaseUrl("https://synpase-os-git-cursor-core-os-317939-ebrines-projects-d0493afe.vercel.app").status,
    "FOUND",
  )
})

test("service role JWT must belong to the isolated project", () => {
  const good = fakeJwt({ ref: EXPECTED_ACCEPTANCE_PROJECT_REF, role: "service_role" })
  assert.equal(validateServiceRoleKey(good).status, "FOUND")
  const prod = fakeJwt({ ref: PRODUCTION_PROJECT_REF, role: "service_role" })
  assert.equal(validateServiceRoleKey(prod).status, "INVALID")
  const anon = fakeJwt({ ref: EXPECTED_ACCEPTANCE_PROJECT_REF, role: "anon" })
  assert.equal(validateServiceRoleKey(anon).status, "INVALID")
})

test("ready payload fails closed without a live database", () => {
  assert.equal(interpretReadyPayload({ status: "not_ready", checks: { database: { ok: false } } }).status, "INVALID")
  const ok = interpretReadyPayload({ status: "ready", checks: { database: { ok: true } }, commitSha: "9cd6c4d" }, "9cd6c4d1448f")
  assert.equal(ok.status, "FOUND")
})
