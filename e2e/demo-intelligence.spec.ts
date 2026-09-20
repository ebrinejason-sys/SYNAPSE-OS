import { expect, test } from "playwright/test"
import { attachWriteGuard, readDemoStore, resetDemo } from "./demo-helpers"

test.describe("Demo Intelligence isolation", () => {
  test("playground uses synthetic Amina, persists decisions, and never mutates production healthcare", async ({ page }) => {
    test.setTimeout(120_000)
    const guard = attachWriteGuard(page)
    await resetDemo(page)

    await page.goto("/demo/intelligence")
    await expect(page.getByRole("heading", { name: "Synapse Intelligence" })).toBeVisible()
    await expect(page.getByText(/Amina Demo/i).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Verify Results" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Dispense", exact: true })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Sign note|Sign clinical/i })).toHaveCount(0)

    const copilot = page.getByRole("region", { name: "Synapse AI" })
    await copilot.getByRole("button", { name: "Synapse AI" }).click()
    await copilot.getByRole("button", { name: "Generate suggestion" }).click()
    await expect(copilot.getByText(/Requires qualified human review/i)).toBeVisible()
    await expect(copilot.getByText(/synthetic-fallback/i)).toBeVisible()
    await copilot.getByRole("button", { name: "Accept" }).click()
    await expect(copilot.getByText(/ACCEPT/)).toBeVisible()

    await page.reload()
    const copilotAfterReload = page.getByRole("region", { name: "Synapse AI" })
    await copilotAfterReload.getByRole("button", { name: "Synapse AI" }).click()
    await expect(copilotAfterReload.getByText(/ACCEPT/)).toBeVisible()
    const decisions = await readDemoStore(page, "intelligence_decisions")
    expect(Array.isArray(decisions) && decisions.length).toBeGreaterThan(0)

    expect(guard.blocked).toEqual([])
    guard.detach()
  })
})
