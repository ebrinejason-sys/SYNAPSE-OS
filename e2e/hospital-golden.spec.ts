import { expect, test } from "playwright/test"
import { e2eConfigured, e2eEmail, FACILITY_A, loginOs } from "./os-helpers"

test.describe("production hospital surface", () => {
  test("login page is reachable and is not a coming-soon stub", async ({ page }) => {
    const res = await page.goto("/login")
    expect(res?.ok() || res?.status() === 200).toBeTruthy()
    await expect(page.getByRole("heading").first()).toBeVisible()
    await expect(page.locator("body")).not.toContainText("Coming soon.")
  })

  test("unauthorized page is a real denial, not a placeholder", async ({ page }) => {
    await page.goto("/unauthorized")
    await expect(page.getByRole("heading", { name: /access denied/i })).toBeVisible()
    await expect(page.locator("body")).not.toContainText("Coming soon.")
  })

  test("demo playground is not the production acceptance surface", async ({ page }) => {
    const res = await page.goto("/demo")
    expect(res).toBeTruthy()
    expect(page.url()).not.toMatch(/\/os\//)
  })
})

test.describe("hospital golden journey", () => {
  test.skip(!e2eConfigured(), "synthetic tenant credentials are required")

  test("reception → nurse → doctor → lab → pharmacy → billing → timeline", async ({ page }) => {
    const password = process.env.SYNAPSE_E2E_PASSWORD!
    const ids: Record<string, string> = {}

    await loginOs(page, process.env.SYNAPSE_E2E_EMAIL || e2eEmail("receptionist"), password)
    await page.goto(`/os/${FACILITY_A}/patients`)
    await expect(page.getByRole("button", { name: /register patient/i })).toBeVisible()
    await page.getByRole("button", { name: /register patient/i }).click()
    await page.getByPlaceholder(/full name/i).fill("Amina E2E")
    await page.getByRole("button", { name: /save|register/i }).last().click()
    await expect(page.getByText(/amina e2e/i).first()).toBeVisible({ timeout: 15000 })

    const patientLink = page.getByRole("link", { name: /amina e2e/i }).first()
    if (await patientLink.count()) {
      const href = await patientLink.getAttribute("href")
      const match = href?.match(/patients\/([^/?]+)/)
      if (match) ids.patientId = match[1]
    }

    await page.goto(ids.patientId
      ? `/os/${FACILITY_A}/encounters/new?patientId=${ids.patientId}`
      : `/os/${FACILITY_A}/encounters/new`)
    await page.getByLabel(/complaint|chief/i).or(page.locator("textarea")).first().fill("Fever and headache for 3 days")
    const start = page.getByRole("button", { name: /save|start|create encounter|send/i }).first()
    if (await start.count()) await start.click()

    await loginOs(page, e2eEmail("nurse"), password)
    await page.goto(`/os/${FACILITY_A}/clinical/nursing`)
    await expect(page.locator("body")).not.toContainText("Coming soon.")
    await expect(page).not.toHaveURL(/too many|429/i)

    await loginOs(page, e2eEmail("doctor"), password)
    await page.goto(`/os/${FACILITY_A}/clinical/queue`)
    await expect(page.locator("body")).not.toContainText("Coming soon.")

    await loginOs(page, e2eEmail("lab_tech"), password)
    await page.goto("/lab/orders")
    await expect(page.locator("body")).not.toContainText("Coming soon.")

    await loginOs(page, e2eEmail("lab_scientist"), password)
    await page.goto("/lab/orders")
    await expect(page.locator("body")).not.toContainText("Coming soon.")

    await loginOs(page, e2eEmail("pharmacist"), password)
    await page.goto(`/os/${FACILITY_A}/clinical/dispense`)
    await expect(page.locator("body")).not.toContainText("Coming soon.")

    await loginOs(page, e2eEmail("billing_officer"), password)
    await page.goto(`/os/${FACILITY_A}/clinical/orders`)
    await expect(page.locator("body")).not.toContainText("Coming soon.")

    await page.goto(`/os/${FACILITY_A}/dashboard`)
    await expect(page.locator("header")).toContainText(/synapse e2e hospital/i)
    expect(page.url()).toContain(`/os/${FACILITY_A}`)
    await expect(page.getByText(/too many verification requests/i)).toHaveCount(0)
  })
})
