import { expect, test, type Page, type APIRequestContext } from "playwright/test"
import { cookieHeader, e2eConfigured, e2eEmail, FACILITY_A, FACILITY_B, loginOs } from "./os-helpers"

const DUMMY_ID = "00000000-0000-4000-8000-000000000001"

async function authedPost(request: APIRequestContext, page: Page, path: string, data: Record<string, unknown>) {
  return request.post(path, {
    headers: { cookie: await cookieHeader(page), "content-type": "application/json" },
    data,
  })
}

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
    const res = await authedPost(request, page, "/api/opd/prescriptions", {
      medicationDisplay: "Artemether/Lumefantrine",
      quantity: 24,
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test("nurse cannot sign a doctor note", async ({ page, request }) => {
    await loginOs(page, e2eEmail("nurse"), process.env.SYNAPSE_E2E_PASSWORD!)
    const res = await authedPost(request, page, `/api/opd/encounters/${DUMMY_ID}/sign`, {})
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test("doctor cannot dispense", async ({ page, request }) => {
    await loginOs(page, e2eEmail("doctor"), process.env.SYNAPSE_E2E_PASSWORD!)
    const res = await authedPost(request, page, "/api/hospital/pharmacy/dispense", {
      prescription_id: DUMMY_ID,
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test("lab technician cannot release when a scientist is required", async ({ page, request }) => {
    await loginOs(page, e2eEmail("lab_tech"), process.env.SYNAPSE_E2E_PASSWORD!)
    const res = await authedPost(request, page, "/api/lab/actions", {
      orderId: DUMMY_ID,
      action: "release",
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test("pharmacist cannot edit diagnosis", async ({ page, request }) => {
    await loginOs(page, e2eEmail("pharmacist"), process.env.SYNAPSE_E2E_PASSWORD!)
    const res = await authedPost(request, page, `/api/opd/encounters/${DUMMY_ID}/write-up`, {
      diagnosis: "malaria",
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test("cashier cannot edit a clinical note", async ({ page, request }) => {
    await loginOs(page, e2eEmail("billing_officer"), process.env.SYNAPSE_E2E_PASSWORD!)
    const res = await authedPost(request, page, `/api/opd/encounters/${DUMMY_ID}/write-up`, {
      note: "altered clinical note",
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test("normal facility admin cannot reach platform admin", async ({ page }) => {
    await loginOs(page, e2eEmail("hospital_admin"), process.env.SYNAPSE_E2E_PASSWORD!)
    const res = await page.goto("/platform/hospitals")
    const body = await page.textContent("body")
    const denied = /access denied|unauthorized|sign in|platform login/i.test(body || "")
      || (res?.status() ?? 200) >= 400
      || /\/platform\/login/.test(page.url())
      || !page.url().includes("/platform/hospitals")
    expect(denied).toBeTruthy()
  })
})
