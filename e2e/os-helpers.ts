import { expect, type Page } from "playwright/test"
import { isAuthenticatedOsLocation } from "./os-location.ts"

export const FACILITY_A = process.env.SYNAPSE_E2E_FACILITY_SLUG || "synapse-e2e-hospital"
export const FACILITY_B = process.env.SYNAPSE_E2E_FACILITY_B_SLUG || "synapse-e2e-hospital-b"

/** Keep in sync with packages/auth/src/e2e-otp.ts — duplicated so Playwright does not import the auth package. */
export const E2E_ROLE_EMAILS = {
  receptionist: "reception.e2e@synapseos.invalid",
  nurse: "nurse.e2e@synapseos.invalid",
  doctor: "doctor.e2e@synapseos.invalid",
  lab_tech: "labtech.e2e@synapseos.invalid",
  lab_scientist: "labscientist.e2e@synapseos.invalid",
  pharmacist: "pharmacist.e2e@synapseos.invalid",
  billing_officer: "cashier.e2e@synapseos.invalid",
  hospital_admin: "admin.e2e@synapseos.invalid",
  doctor_b: "doctor.b.e2e@synapseos.invalid",
} as const

export function e2eEmail(role: string, facility = "a") {
  const envKey = `SYNAPSE_E2E_${role.toUpperCase()}_EMAIL`
  if (process.env[envKey]) return process.env[envKey]!
  if (facility === "b" && role === "doctor") return E2E_ROLE_EMAILS.doctor_b
  return (E2E_ROLE_EMAILS as Record<string, string>)[role] || E2E_ROLE_EMAILS.receptionist
}

export function e2eConfigured() {
  return Boolean(
    process.env.SYNAPSE_E2E_EMAIL
    && process.env.SYNAPSE_E2E_PASSWORD
    && process.env.SYNAPSE_E2E_FIXED_OTP,
  )
}

function e2eOtp() {
  const otp = String(process.env.SYNAPSE_E2E_FIXED_OTP || "").trim()
  if (!/^\d{6}$/.test(otp)) {
    throw new Error("SYNAPSE_E2E_FIXED_OTP must be a 6-digit secret in the protected acceptance environment")
  }
  return otp
}

export async function cookieHeader(page: Page) {
  const cookies = await page.context().cookies()
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
}

export async function expectAuthenticatedWorkspace(page: Page, slug: string) {
  await expect.poll(() => isAuthenticatedOsLocation(page.url(), slug), {
    timeout: 20000,
    message: `expected authenticated /os/${slug} workspace, not a login or next= URL`,
  }).toBe(true)
  await expect(page.getByRole("heading", { name: /welcome back|staff sign in|check your email/i })).toHaveCount(0)
  await expect(page.locator("header")).toBeVisible()
  await expect(page.getByRole("link", { name: /dashboard/i }).first()).toBeVisible()
  await expect(page.locator("body")).not.toContainText("Coming soon.")
}

/**
 * Signs in and lands on the facility OS shell.
 * After OTP verify, navigates explicitly to /os/{slug}/dashboard so role-default
 * redirects (/doctor, /nurse, external pharmacy) cannot skip the facility assertion.
 */
export async function loginOs(page: Page, email: string, password: string, slug = FACILITY_A) {
  await page.context().clearCookies()
  await page.goto(`/login?next=/os/${encodeURIComponent(slug)}/dashboard`)
  await expect.poll(() => new URL(page.url()).pathname).toBe("/login")
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible()
  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole("button", { name: /^sign in$/i }).click()
  await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible({ timeout: 15000 })
  await page.getByPlaceholder("000000").fill(e2eOtp())
  await page.getByRole("button", { name: /verify & sign in/i }).click()
  // Wait until we leave the OTP step (session cookie set), then open facility shell.
  await expect.poll(() => {
    const path = new URL(page.url()).pathname
    return path !== "/login" || !page.url().includes("check")
  }, { timeout: 20000 }).toBeTruthy()
  await page.goto(`/os/${encodeURIComponent(slug)}/dashboard`)
  await expectAuthenticatedWorkspace(page, slug)
}
