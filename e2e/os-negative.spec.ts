import { expect, test } from "playwright/test"
import { e2eConfigured, e2eEmail, FACILITY_A, FACILITY_B, loginOs } from "./os-helpers"

test.describe("production OS negative controls", () => {
  test.skip(!e2eConfigured(), "synthetic tenant credentials are required")

  test("facility B doctor cannot open facility A patients", async ({ page }) => {
    await loginOs(page, e2eEmail("doctor", "b"), process.env.SYNAPSE_E2E_PASSWORD!, FACILITY_B)
    const res = await page.goto(`/os/${FACILITY_A}/patients`)
    const body = await page.textContent("body")
    const denied = /facility-access|access denied|sign in|unauthorized/i.test(body || "") || (res?.status() ?? 200) >= 400
    expect(denied || !page.url().includes(`/os/${FACILITY_A}/patients`)).toBeTruthy()
  })

  test("receptionist cannot prescribe through the API", async ({ page, request }) => {
    await loginOs(page, e2eEmail("receptionist"), process.env.SYNAPSE_E2E_PASSWORD!)
    const cookies = await page.context().cookies()
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ")
    const res = await request.post("/api/opd/prescriptions", {
      headers: { cookie: cookieHeader, "content-type": "application/json" },
      data: {
        medicationDisplay: "Artemether/Lumefantrine",
        quantity: 24,
      },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})
