#!/usr/bin/env node
import { chromium } from "playwright"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const base = process.env.PLAYWRIGHT_BASE_URL || process.env.SYNAPSE_E2E_BASE_URL
const outDir = join(process.cwd(), "artifacts/readiness")
mkdirSync(outDir, { recursive: true })

if (!base) {
  writeFileSync(join(outDir, "hospital-browser-journey.json"), JSON.stringify({
    status: "BLOCKED",
    reason: "SYNAPSE_E2E_BASE_URL not configured",
    journey: "hospital-browser",
  }, null, 2))
  console.log("Hospital browser journey BLOCKED")
  process.exit(0)
}

const browser = await chromium.launch()
const page = await browser.newPage()
const failures = []

async function check(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    failures.push({ name, error: error instanceof Error ? error.message : String(error) })
    console.error(`FAIL ${name}`, error)
  }
}

await check("login_not_coming_soon", async () => {
  const res = await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" })
  if (!res || res.status() >= 500) throw new Error(`login HTTP ${res?.status()}`)
  const body = await page.textContent("body")
  if (body?.includes("Coming soon.")) throw new Error("login is a coming-soon stub")
})

await check("unauthorized_page", async () => {
  await page.goto(`${base}/unauthorized`, { waitUntil: "domcontentloaded" })
  const body = await page.textContent("body")
  if (body?.includes("Coming soon.")) throw new Error("unauthorized is a coming-soon stub")
  if (!/access denied/i.test(body ?? "")) throw new Error("unauthorized heading missing")
})

if (process.env.SYNAPSE_E2E_EMAIL && process.env.SYNAPSE_E2E_PASSWORD) {
  await check("authenticated_facility_shell", async () => {
    await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" })
    await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.SYNAPSE_E2E_EMAIL)
    await page.locator('input[type="password"]').first().fill(process.env.SYNAPSE_E2E_PASSWORD)
    await page.getByRole("button", { name: /sign in/i }).click()
    await page.waitForURL(/\/(os|hospital|doctor|nurse|lab|platform)/, { timeout: 20000 })
    const body = await page.textContent("body")
    if (body?.includes("Coming soon.")) throw new Error("landed on coming-soon after login")
  })
}

await browser.close()
const status = failures.length ? "FAIL" : "PASS"
writeFileSync(join(outDir, "hospital-browser-journey.json"), JSON.stringify({
  status,
  base,
  failures,
  generated_at: new Date().toISOString(),
}, null, 2))
if (failures.length) process.exit(1)
console.log("Hospital browser journey PASS")
