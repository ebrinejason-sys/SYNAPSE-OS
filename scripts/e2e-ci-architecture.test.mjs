import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8")
const acceptance = readFileSync(join(root, ".github/workflows/os-e2e-acceptance.yml"), "utf8")
const helpers = readFileSync(join(root, "e2e/os-helpers.ts"), "utf8")
const seed = readFileSync(join(root, "scripts/seed-e2e-os-fixture.ts"), "utf8")
const playwright = readFileSync(join(root, "playwright.config.ts"), "utf8")

test("pull_request CI never receives a production service-role key", () => {
  assert.doesNotMatch(ci, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(ci, /SUPABASE_DB_URL/)
  assert.doesNotMatch(ci, /SYNAPSE_E2E_FIXED_OTP/)
})

test("privileged hospital E2E runs only from a protected workflow on an exact SHA", () => {
  assert.doesNotMatch(acceptance, /pull_request:/)
  assert.match(acceptance, /environment:\s+production-acceptance/)
  assert.match(acceptance, /workflow_dispatch:/)
  assert.match(acceptance, /EXPECTED_SHA/)
  assert.match(acceptance, /Refusing to start localhost/)
})

test("Playwright helpers do not plant OTPs or hardcode a reusable code", () => {
  assert.doesNotMatch(helpers, /plantKnownOtp/)
  assert.doesNotMatch(helpers, /246801/)
  assert.doesNotMatch(helpers, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(helpers, /SYNAPSE_E2E_FIXED_OTP/)
  assert.match(helpers, /expectAuthenticatedWorkspace/)
})

test("seed uses production bcrypt hashing and fail-closed synthetic slugs", () => {
  assert.match(seed, /hashPassword/)
  assert.match(seed, /verifyPassword/)
  assert.doesNotMatch(seed, /createHash\(/)
  assert.doesNotMatch(seed, /sha256/i)
  assert.match(seed, /SYNAPSE_E2E_SEED/)
  assert.match(seed, /synapse-e2e-hospital/)
  assert.doesNotMatch(seed, /qfqakzmjatszisuqjwon/)
})

test("Playwright webServer starts only for the canonical local target", () => {
  assert.match(playwright, /logPlaywrightTarget/)
  assert.match(playwright, /target\.startWebServer/)
})
