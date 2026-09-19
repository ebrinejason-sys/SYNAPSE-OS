import assert from "node:assert/strict"
import { test } from "node:test"
import { vercelGitDeployDecision } from "./vercel-build-gate.mjs"

test("OS production git deploys stay skipped", () => {
  const d = vercelGitDeployDecision({
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "synapseos.tech",
  })
  assert.equal(d.skip, true)
})

test("OS preview git deploys always build", () => {
  const d = vercelGitDeployDecision({
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_PRODUCTION_URL: "synapseos.tech",
  })
  assert.equal(d.skip, false)
})

test("demo production git deploys still build", () => {
  const d = vercelGitDeployDecision({
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "demo.synapseos.tech",
  })
  assert.equal(d.skip, false)
})
