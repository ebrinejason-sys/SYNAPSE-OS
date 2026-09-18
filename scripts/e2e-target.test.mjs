import assert from "node:assert/strict"
import { test } from "node:test"
import { resolvePlaywrightTarget } from "./e2e-target.mjs"

test("a remote SYNAPSE_E2E_BASE_URL does not start the local webServer", () => {
  const target = resolvePlaywrightTarget({
    SYNAPSE_E2E_BASE_URL: "https://preview.example.test",
  })
  assert.equal(target.mode, "remote")
  assert.equal(target.host, "preview.example.test")
  assert.equal(target.startWebServer, false)
})

test("PLAYWRIGHT_BASE_URL wins and stays remote", () => {
  const target = resolvePlaywrightTarget({
    PLAYWRIGHT_BASE_URL: "https://os.example.test",
    SYNAPSE_E2E_BASE_URL: "https://ignored.example.test",
  })
  assert.equal(target.baseURL, "https://os.example.test")
  assert.equal(target.startWebServer, false)
})

test("local mode is explicit when no remote URL is set", () => {
  const target = resolvePlaywrightTarget({})
  assert.equal(target.mode, "local")
  assert.equal(target.host, "127.0.0.1")
  assert.equal(target.startWebServer, true)
})
