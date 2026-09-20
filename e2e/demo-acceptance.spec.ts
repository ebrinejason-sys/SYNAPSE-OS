import { expect, test } from "playwright/test"
import { attachWriteGuard, readDemoStore, resetDemo, startReceptionVisit } from "./demo-helpers"

const ROUTES = [
  "/demo",
  "/demo/workspace",
  "/demo/reception",
  "/demo/nurse",
  "/demo/doctor",
  "/demo/lab",
  "/demo/pharmacist",
  "/demo/billing",
  "/demo/timeline",
  "/demo/network",
  "/demo/admin",
  "/demo/guide",
  "/demo/feedback",
  "/demo/login",
  "/demo/intelligence",
]

test.describe("Demo acceptance", () => {
  test("dead-end crawler has 0 presented dead controls or routes", async ({ page }) => {
    const dead: string[] = []
    for (const route of ROUTES) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" })
      const status = response?.status() ?? 0
      if (status >= 400) dead.push(`${route} HTTP ${status}`)
      const body = (await page.locator("body").innerText()).toLowerCase()
      if (body.includes("coming soon") || body.includes("placeholder page")) dead.push(`${route} placeholder`)
      const hashLinks = await page.locator('a[href="#"]').count()
      if (hashLinks > 0) dead.push(`${route} href=# x${hashLinks}`)
    }
    expect(dead).toEqual([])
  })

  test("empty states offer a next action and landing hierarchy is clear", async ({ page }) => {
    await resetDemo(page)
    await expect(page.getByRole("link", { name: "Start Test Drive" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Try Clinical AI" })).toBeVisible()
    await page.getByRole("link", { name: "Start Test Drive" }).click()
    await page.getByRole("heading", { name: "Nurse", exact: true }).click()
    await expect(page.getByRole("heading", { name: "No patients waiting for triage" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Start a visit at Reception" })).toBeVisible()
    await page.locator('nav[aria-label="Golden journey stations"]').getByRole("link", { name: /^[✓●]?\s*Doctor$/ }).click()
    await expect(page.getByRole("heading", { name: "No patient ready for Doctor review" })).toBeVisible()
    await page.locator('nav[aria-label="Golden journey stations"]').getByRole("link", { name: /^[✓●]?\s*Lab$/ }).click()
    await expect(page.getByRole("heading", { name: "No Lab orders" })).toBeVisible()
    await page.locator('nav[aria-label="Golden journey stations"]').getByRole("link", { name: /Pharmacy/ }).click()
    await expect(page.getByRole("heading", { name: "No prescriptions waiting" })).toBeVisible()
    await page.locator('nav[aria-label="Golden journey stations"]').getByRole("link", { name: /Billing/ }).click()
    await expect(page.getByRole("heading", { name: "No active encounter ready for billing" })).toBeVisible()
  })

  test("station click switches role without a passive mismatch warning", async ({ page }) => {
    await resetDemo(page)
    await page.getByRole("link", { name: "Start Test Drive" }).click()
    await page.getByRole("link", { name: "Recommended start: Reception" }).click()
    for (const station of ["Nurse", "Doctor", "Lab", "Pharmacy", "Billing", "Timeline"]) {
      const pattern = station === "Doctor" ? /^[✓●]?\s*Doctor$/ : new RegExp(station)
      await page.locator('nav[aria-label="Golden journey stations"]').getByRole("link", { name: pattern }).click()
      await expect(page.getByText("Role mismatch")).toHaveCount(0)
      await expect(page.getByText("You're currently using the")).toHaveCount(0)
    }
  })

  test("duplicate encounter, dispense and payment stay single", async ({ page }) => {
    test.setTimeout(120_000)
    await resetDemo(page)
    await startReceptionVisit(page)
    await page.getByRole("button", { name: "Register Another Patient" }).click()
    await page.getByRole("button", { name: /Amina Demo/ }).first().click()
    await page.getByLabel("Chief Complaint").fill("Second start attempt")
    await page.getByRole("button", { name: "Start Visit & Send to Triage" }).click()
    const encounters = await readDemoStore(page, "encounters")
    expect(encounters).toHaveLength(1)
  })

  test("RBAC keeps nurse and reception off doctor-only actions", async ({ page }) => {
    await resetDemo(page)
    await page.getByRole("link", { name: "Start Test Drive" }).click()
    await page.getByRole("heading", { name: "Nurse", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Nurse Station" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Sign Note/ })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Prescribe/ })).toHaveCount(0)
    await page.locator('nav[aria-label="Golden journey stations"]').getByRole("link", { name: /Reception/ }).click()
    await expect(page.getByRole("heading", { name: "Reception" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Prescribe/ })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Sign Note/ })).toHaveCount(0)
  })

  test("Reset Playground restores baseline and keeps theme", async ({ page }) => {
    await resetDemo(page)
    await page.getByRole("button", { name: "Change color theme" }).click()
    await page.getByRole("menuitemradio", { name: "Dark" }).click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await startReceptionVisit(page)
    await page.goto("/demo")
    await page.getByRole("button", { name: "Reset Playground" }).click()
    await expect(page.getByRole("heading", { name: /SYNAPSE Test Drive/i })).toBeVisible()
    await expect.poll(async () => ((await readDemoStore(page, "encounters")) as unknown[]).length).toBe(0)
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await page.getByRole("button", { name: "Change color theme" }).click()
    await page.getByRole("menuitemradio", { name: "Light" }).click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    await page.getByRole("button", { name: "Change color theme" }).click()
    await page.getByRole("menuitemradio", { name: "System" }).click()
  })

  test("375px landing and reception stay usable", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await resetDemo(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 390)
    expect(overflow).toBeFalsy()
    await page.getByRole("link", { name: "Start Test Drive" }).click()
    await page.getByRole("link", { name: "Recommended start: Reception" }).click()
    await expect(page.getByRole("heading", { name: "Reception" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Start Visit & Send to Triage" })).toBeVisible()
    const stationOverflow = await page.evaluate(() => {
      const rail = document.querySelector(".demo-rail") as HTMLElement | null
      return rail ? getComputedStyle(rail).flexWrap === "nowrap" : false
    })
    expect(stationOverflow).toBeTruthy()
  })

  test("demo does not write production healthcare APIs", async ({ page }) => {
    const guard = attachWriteGuard(page)
    await resetDemo(page)
    await startReceptionVisit(page)
    expect(guard.blocked).toEqual([])
    guard.detach()
  })
})
