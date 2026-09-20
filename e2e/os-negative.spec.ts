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

  test("cashier cannot dispense", async ({ page, request }) => {
    await loginOs(page, e2eEmail("billing_officer"), process.env.SYNAPSE_E2E_PASSWORD!)
    const res = await authedPost(request, page, "/api/hospital/pharmacy/dispense", {
      prescription_id: DUMMY_ID,
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test("doctor cannot record a cashier payment", async ({ page, request }) => {
    await loginOs(page, e2eEmail("doctor"), process.env.SYNAPSE_E2E_PASSWORD!)
    const res = await authedPost(request, page, `/api/hospital/billing/encounter/${DUMMY_ID}/pay`, {
      amount: 1000,
      payment_method: "cash",
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test("tenant B cannot read tenant A encounter billing", async ({ page, request }) => {
    const tenantAEncounter = process.env.SYNAPSE_E2E_ENCOUNTER_ID || "72603ece-b91a-45ad-a6bc-c59bff1162db"
    await loginOs(page, e2eEmail("doctor", "b"), process.env.SYNAPSE_E2E_PASSWORD!, FACILITY_B)
    const res = await request.get(`/api/hospital/billing/encounter/${tenantAEncounter}`, {
      headers: { cookie: await cookieHeader(page) },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    const body = await res.text()
    expect(body).not.toMatch(/INV-/i)
  })

  test("unauthenticated billing lookup is denied", async ({ request }) => {
    const res = await request.get(`/api/hospital/billing/encounter/${DUMMY_ID}`)
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

  test("tampered synapse session is rejected", async ({ page, request }) => {
    await loginOs(page, e2eEmail("receptionist"), process.env.SYNAPSE_E2E_PASSWORD!)
    const cookie = (await page.context().cookies()).find((row) => row.name === "synapse_session")
    expect(cookie?.value).toBeTruthy()
    const [header, payload, signature] = String(cookie?.value).split(".")
    expect(signature).toBeTruthy()

    const invalidSig = await request.get(`/os/${FACILITY_A}/patients`, {
      headers: { cookie: `synapse_session=${header}.${payload}.${signature.slice(0, -2)}aa` },
    })
    const invalidBody = await invalidSig.text()
    expect(
      invalidSig.status() >= 400
      || /sign in|access denied|unauthorized/i.test(invalidBody)
      || !invalidSig.url().includes(`/os/${FACILITY_A}/patients`),
    ).toBeTruthy()

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>
    claims.tenant_id = "200dfeb5-4c09-4a5d-8d46-14aa4b78a6ec"
    const tamperedPayload = Buffer.from(JSON.stringify(claims)).toString("base64url")
    const tamperedTenant = await request.get(`/api/opd/queue`, {
      headers: { cookie: `synapse_session=${header}.${tamperedPayload}.${signature}` },
    })
    expect(tamperedTenant.status()).toBeGreaterThanOrEqual(400)

    claims.exp = 1
    const expiredPayload = Buffer.from(JSON.stringify(claims)).toString("base64url")
    const expired = await request.get(`/api/opd/queue`, {
      headers: { cookie: `synapse_session=${header}.${expiredPayload}.${signature}` },
    })
    expect(expired.status()).toBeGreaterThanOrEqual(400)
  })
})
