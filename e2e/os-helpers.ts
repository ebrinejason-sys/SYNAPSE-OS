import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { expect, type Page } from "playwright/test"

export const E2E_OTP = "246801"
export const FACILITY_A = process.env.SYNAPSE_E2E_FACILITY_SLUG || "synapse-e2e-hospital"
export const FACILITY_B = process.env.SYNAPSE_E2E_FACILITY_B_SLUG || "synapse-e2e-hospital-b"

export function e2eEmail(role: string, facility = "a") {
  return process.env[`SYNAPSE_E2E_${role.toUpperCase()}_EMAIL`] || `e2e.${role}.${facility}@synapseos.invalid`
}

export function e2eConfigured() {
  return Boolean(process.env.SYNAPSE_E2E_EMAIL && process.env.SYNAPSE_E2E_PASSWORD)
}

function hashOtp(otp: string) {
  return createHash("sha256").update(otp).digest("hex")
}

export function serviceDb() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function plantKnownOtp(email: string) {
  const db = serviceDb()
  if (!db) throw new Error("SUPABASE_SERVICE_ROLE_KEY required to plant synthetic OTP")
  const { error } = await db.from("auth_otps").insert({
    channel: "email",
    target: email,
    otp_hash: hashOtp(E2E_OTP),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    used: false,
    attempts: 0,
  })
  if (error) throw new Error(error.message)
}

export async function loginOs(page: Page, email: string, password: string, slug = FACILITY_A) {
  await page.goto(`/os/${slug}/login`)
  await page.locator('input[type="email"], input[name="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole("button", { name: /sign in|continue|log in/i }).first().click()
  await plantKnownOtp(email)
  const otp = page.getByPlaceholder("000000")
  await expect(otp).toBeVisible({ timeout: 15000 })
  await otp.fill(E2E_OTP)
  await page.getByRole("button", { name: /verify|continue|sign in/i }).first().click()
  await page.waitForURL(new RegExp(`/os/${slug}`), { timeout: 20000 })
  await expect(page.locator("body")).not.toContainText("Coming soon.")
}
