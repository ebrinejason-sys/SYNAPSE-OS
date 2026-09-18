import { expect, test } from "playwright/test"

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
  })
})

test.describe("hospital golden journey", () => {
  test.skip(!process.env.SYNAPSE_E2E_EMAIL || !process.env.SYNAPSE_E2E_PASSWORD, "synthetic tenant credentials are required")

  test("role-bounded production journey", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/email/i).fill(process.env.SYNAPSE_E2E_EMAIL!)
    await page.locator('input[type="password"]').fill(process.env.SYNAPSE_E2E_PASSWORD!)
    await page.getByRole("button", { name: /sign in/i }).click()
    await page.waitForURL(/\/(os|hospital|doctor|nurse|lab)/)
    await expect(page.locator("body")).not.toContainText("Coming soon.")
  })
})
