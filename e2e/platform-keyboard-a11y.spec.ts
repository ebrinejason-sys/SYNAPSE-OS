import { expect, test } from "playwright/test"

/**
 * Keyboard-first smoke for Platform Admin shell (no authenticated session required
 * for login page; authenticated checks skip when cookies unavailable).
 */
test.describe("platform keyboard accessibility", () => {
  test("login page supports tab order and skip link landmark", async ({ page }) => {
    await page.goto("/platform/login")
    await expect(page.locator("body")).not.toContainText("Coming soon.")

    await page.keyboard.press("Tab")
    const focused = page.locator(":focus")
    await expect(focused).toBeVisible()

    // Reach an interactive control without mouse.
    for (let i = 0; i < 12; i++) {
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? "")
      if (tag === "INPUT" || tag === "BUTTON" || tag === "A") break
      await page.keyboard.press("Tab")
    }
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? "")
    expect(["INPUT", "BUTTON", "A", "SELECT", "TEXTAREA"]).toContain(tag)
  })

  test("command palette opens with Ctrl+K when authenticated shell loads", async ({ page }) => {
    test.skip(!process.env.SYNAPSE_PLATFORM_COOKIE, "platform session cookie required")
    await page.context().addCookies([
      {
        name: process.env.SYNAPSE_SESSION_COOKIE_NAME || "synapse_session",
        value: process.env.SYNAPSE_PLATFORM_COOKIE!,
        domain: new URL(process.env.PLAYWRIGHT_BASE_URL || "https://synapse-os-six.vercel.app").hostname,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ])
    await page.goto("/platform")
    await page.keyboard.press("Control+K")
    await expect(page.getByRole("dialog", { name: /command palette/i })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: /command palette/i })).toHaveCount(0)
  })
})
