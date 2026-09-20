import { expect, test } from "playwright/test"
import { authedJson, e2eConfigured, e2eEmail, FACILITY_A, loginOs } from "./os-helpers"

const AMNA = "Amina E2E"
const PATIENT_ID = "19bc626f-f51a-4bd5-aefd-7a4534babfeb"
const SYNAPSE_ID = "SYN-UG-7TA1XEA40"
const TENANT_A = "0edb651a-232a-4289-9b3d-ae5bb1bac2cb"

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
  test.describe.configure({ timeout: 240_000 })

  test("reception → nurse → doctor → lab → pharmacy → billing → timeline", async ({ page }) => {
    const password = process.env.SYNAPSE_E2E_PASSWORD!
    const ids: Record<string, string> = {
      tenantId: TENANT_A,
      patientId: PATIENT_ID,
      synapseId: SYNAPSE_ID,
    }

    await loginOs(page, process.env.SYNAPSE_E2E_EMAIL || e2eEmail("receptionist"), password)
    await page.goto(`/os/${FACILITY_A}/patients?q=Amina`)
    const aminaLink = page.getByRole("link", { name: /amina e2e/i })
    await expect(aminaLink.first()).toBeVisible({ timeout: 15000 })
    await expect(aminaLink).toHaveCount(1)
    await aminaLink.first().click()
    await expect(page.getByRole("heading", { name: /amina e2e/i })).toBeVisible()
    await expect(page.locator("body")).toContainText(SYNAPSE_ID)

    const encounterRes = await authedJson(page, "/api/opd/triage", {
      method: "POST",
      data: {
        patient_id: PATIENT_ID,
        chief_complaint: "Fever and headache for 3 days",
        clinical_stage: "YELLOW",
      },
    })
    expect(encounterRes.status, `reception encounter HTTP ${encounterRes.status} ${JSON.stringify(encounterRes.json)}`).toBeLessThan(300)
    const encounterId = String((encounterRes.json as { encounterId?: string }).encounterId || "")
    expect(encounterId).toMatch(/^[0-9a-f-]{36}$/i)
    ids.encounterId = encounterId

    await loginOs(page, e2eEmail("nurse"), password)
    await page.goto(`/os/${FACILITY_A}/clinical/nursing`)
    await expect(page.locator("body")).not.toContainText("Coming soon.")
    const vitalsRes = await authedJson(page, "/api/nurse/vitals", {
      method: "POST",
      data: {
        encounter_id: encounterId,
        patient_id: PATIENT_ID,
        temperature_c: 38.2,
        heart_rate: 96,
        bp_systolic: 118,
        bp_diastolic: 74,
        spo2: 97,
        respiratory_rate: 20,
      },
    })
    expect(vitalsRes.status, `nurse vitals HTTP ${vitalsRes.status} ${JSON.stringify(vitalsRes.json)}`).toBeLessThan(300)

    await loginOs(page, e2eEmail("doctor"), password)
    await page.goto(`/os/${FACILITY_A}/clinical/queue`)
    await expect(page.locator("body")).not.toContainText("Coming soon.")
    const writeup = await authedJson(page, `/api/opd/encounters/${encounterId}/write-up`, {
      method: "PUT",
      data: {
        hpi: "Fever and headache for 3 days, no neck stiffness",
        pmh: "None significant",
        medications: "None",
        allergies: "NKDA",
        familySocial: "Lives with family; non-smoker",
        ros: "Denies chest pain, SOB, vomiting",
        examination: "Alert, febrile 38.2C, no focal neuro signs",
        assessment: "Likely viral illness; rule out malaria",
        plan: "Paracetamol, FBC and malaria RDT, review if worse",
      },
    })
    expect(writeup.status, `doctor write-up HTTP ${writeup.status} ${JSON.stringify(writeup.json)}`).toBeLessThan(300)

    const fbc = await authedJson(page, "/api/opd/lab-orders", {
      method: "POST",
      data: {
        encounter_id: encounterId,
        patient_id: PATIENT_ID,
        loinc_code: "58410-2",
        test_name: "FBC",
        urgency: "ROUTINE",
      },
    })
    expect(fbc.status, `FBC order HTTP ${fbc.status} ${JSON.stringify(fbc.json)}`).toBe(201)
    const fbcId = String((fbc.json as { orderId?: string }).orderId || "")

    const rdt = await authedJson(page, "/api/opd/lab-orders", {
      method: "POST",
      data: {
        encounter_id: encounterId,
        patient_id: PATIENT_ID,
        loinc_code: "70569-9",
        test_name: "Malaria RDT",
        urgency: "STAT",
      },
    })
    expect(rdt.status, `RDT order HTTP ${rdt.status} ${JSON.stringify(rdt.json)}`).toBe(201)
    const rdtId = String((rdt.json as { orderId?: string }).orderId || "")

    const rx = await authedJson(page, "/api/opd/prescriptions", {
      method: "POST",
      data: {
        encounter_id: encounterId,
        patient_id: PATIENT_ID,
        medication_display: "Paracetamol 500mg",
        dose: "1 tablet TID x 3 days",
        quantity: 9,
        unit: "tablet",
      },
    })
    expect(rx.status, `prescription HTTP ${rx.status} ${JSON.stringify(rx.json)}`).toBeLessThan(300)
    const prescriptionId = String((rx.json as { prescriptionId?: string }).prescriptionId || "")
    expect(prescriptionId).toBeTruthy()

    const signed = await authedJson(page, `/api/opd/encounters/${encounterId}/sign`, { method: "POST" })
    expect(signed.status, `sign HTTP ${signed.status} ${JSON.stringify(signed.json)}`).toBeLessThan(300)

    await loginOs(page, e2eEmail("lab_tech"), password)
    await page.goto("/lab/orders")
    await expect(page.locator("body")).not.toContainText("Coming soon.")
    for (const orderId of [fbcId, rdtId]) {
      const collect = await authedJson(page, "/api/lab/actions", {
        method: "POST",
        data: { orderId, action: "collect", accessionNumber: `E2E-${orderId.slice(0, 8)}` },
      })
      expect(collect.status, `collect ${orderId} HTTP ${collect.status} ${JSON.stringify(collect.json)}`).toBeLessThan(300)
      const receive = await authedJson(page, "/api/lab/actions", {
        method: "POST",
        data: { orderId, action: "receive" },
      })
      expect(receive.status, `receive ${orderId} HTTP ${receive.status} ${JSON.stringify(receive.json)}`).toBeLessThan(300)
      const enter = await authedJson(page, "/api/lab/actions", {
        method: "POST",
        data: {
          orderId,
          action: "enter_result",
          value: orderId === rdtId ? "Negative" : "WBC 6.2",
        },
      })
      expect(enter.status, `enter ${orderId} HTTP ${enter.status} ${JSON.stringify(enter.json)}`).toBeLessThan(300)
    }

    await loginOs(page, e2eEmail("lab_scientist"), password)
    await page.goto("/lab/orders")
    for (const orderId of [fbcId, rdtId]) {
      const verify = await authedJson(page, "/api/lab/actions", {
        method: "POST",
        data: { orderId, action: "verify" },
      })
      expect(verify.status, `verify ${orderId} HTTP ${verify.status} ${JSON.stringify(verify.json)}`).toBeLessThan(300)
      const release = await authedJson(page, "/api/lab/actions", {
        method: "POST",
        data: { orderId, action: "release" },
      })
      expect(release.status, `release ${orderId} HTTP ${release.status} ${JSON.stringify(release.json)}`).toBeLessThan(300)
    }

    await loginOs(page, e2eEmail("doctor"), password)
    const review = await authedJson(page, `/api/opd/lab-orders?encounter_id=${encounterId}`)
    expect(review.status, `doctor review HTTP ${review.status} ${JSON.stringify(review.json)}`).toBeLessThan(300)
    const orders = ((review.json as { orders?: Array<{ id: string; test_name: string }> }).orders ?? [])
    expect(orders.some((row) => row.id === fbcId)).toBeTruthy()
    expect(orders.some((row) => row.id === rdtId)).toBeTruthy()

    await loginOs(page, e2eEmail("pharmacist"), password)
    await page.goto(`/os/${FACILITY_A}/clinical/dispense`)
    await expect(page.locator("body")).not.toContainText("Coming soon.")
    const productId = process.env.SYNAPSE_E2E_PARA_PRODUCT_ID
    expect(productId, "SYNAPSE_E2E_PARA_PRODUCT_ID must be set from the isolated seed").toBeTruthy()
    const dispense = await authedJson(page, "/api/hospital/pharmacy/dispense", {
      method: "POST",
      data: {
        prescription_id: prescriptionId,
        product_id: productId,
        pharmacy_tenant_id: TENANT_A,
        payment_method: "cash",
      },
    })
    expect(dispense.status, `dispense HTTP ${dispense.status} ${JSON.stringify(dispense.json)}`).toBeLessThan(300)

    await loginOs(page, e2eEmail("billing_officer"), password)
    await page.goto(`/os/${FACILITY_A}/clinical/orders`)
    await expect(page.locator("body")).not.toContainText("Coming soon.")
    const invoiceLookups = []
    for (let i = 0; i < 3; i += 1) {
      invoiceLookups.push(await authedJson(page, `/api/hospital/billing/encounter/${encounterId}`))
    }
    for (const invoice of invoiceLookups) {
      expect(invoice.status, `invoice HTTP ${invoice.status} ${JSON.stringify(invoice.json)}`).toBeLessThan(300)
    }
    const invoiceBody = invoiceLookups[0]!.json as {
      invoice?: { id?: string; encounter_id?: string; patient_id?: string; total_amount?: number; paid_amount?: number } | null
      lineItems?: Array<{ item_name?: string; qty?: number; unit_price?: number; total_price?: number }>
    }
    expect(invoiceBody.invoice, "invoice must be derived from the journey").toBeTruthy()
    expect(invoiceBody.invoice?.encounter_id).toBe(encounterId)
    expect(invoiceBody.invoice?.patient_id).toBe(PATIENT_ID)
    const names = (invoiceBody.lineItems ?? []).map((row) => String(row.item_name ?? ""))
    expect(names.some((name) => /consultation/i.test(name))).toBeTruthy()
    expect(names.some((name) => /FBC/i.test(name))).toBeTruthy()
    expect(names.some((name) => /Malaria/i.test(name))).toBeTruthy()
    expect(names.some((name) => /Paracetamol/i.test(name))).toBeTruthy()
    const amount = Number(invoiceBody.invoice?.total_amount ?? 0)
    const lineTotal = (invoiceBody.lineItems ?? []).reduce(
      (sum, row) => sum + Number(row.total_price ?? Number(row.qty ?? 0) * Number(row.unit_price ?? 0)),
      0,
    )
    expect(amount).toBeGreaterThan(0)
    expect(amount).toBeCloseTo(lineTotal, 2)
    expect(invoiceLookups[1]!.json).toMatchObject({
      invoice: { id: invoiceBody.invoice?.id, total_amount: amount },
    })
    expect(invoiceLookups[2]!.json).toMatchObject({
      invoice: { id: invoiceBody.invoice?.id, total_amount: amount },
    })
    expect(((invoiceLookups[1]!.json as { lineItems?: unknown[] }).lineItems ?? []).length).toBe(invoiceBody.lineItems?.length)
    expect(((invoiceLookups[2]!.json as { lineItems?: unknown[] }).lineItems ?? []).length).toBe(invoiceBody.lineItems?.length)
    const pay = await authedJson(page, `/api/hospital/billing/encounter/${encounterId}/pay`, {
      method: "POST",
      data: { amount, payment_method: "cash" },
    })
    expect(pay.status, `payment HTTP ${pay.status} ${JSON.stringify(pay.json)}`).toBeLessThan(300)
    const payment = (pay.json as { payment?: { receiptNumber?: string; status?: string; amount?: number } }).payment
    expect(payment?.receiptNumber).toMatch(/^RCP-/)
    expect(payment?.status).toBe("paid")
    expect(Number(payment?.amount)).toBe(amount)

    const paidInvoice = await authedJson(page, `/api/hospital/billing/encounter/${encounterId}`)
    expect(paidInvoice.status).toBeLessThan(300)
    const paidBody = paidInvoice.json as {
      invoice?: { status?: string; paid_amount?: number }
      payments?: Array<{ receipt_number?: string; amount?: number }>
    }
    expect(paidBody.invoice?.status).toBe("paid")
    expect(Number(paidBody.invoice?.paid_amount)).toBe(amount)
    expect(paidBody.payments?.[0]?.receipt_number).toBe(payment?.receiptNumber)

    await loginOs(page, e2eEmail("doctor"), password)
    const timeline = await authedJson(page, `/api/hospital/timeline/encounter/${encounterId}`)
    expect(timeline.status, `timeline HTTP ${timeline.status} ${JSON.stringify(timeline.json)}`).toBeLessThan(300)
    const events = ((timeline.json as { events?: Array<{ event_type?: string; title?: string }> }).events ?? [])
    expect(events.length, `timeline events ${JSON.stringify(events)}`).toBeGreaterThan(0)
    const haystack = events.map((row) => `${row.event_type ?? ""} ${row.title ?? ""}`).join(" | ")
    expect(haystack, haystack).toMatch(/lab/i)
    expect(haystack, haystack).toMatch(/prescri|dispens|paracetamol/i)
    expect(haystack, haystack).toMatch(/payment|signed|consultation|encounter/i)

    await page.goto(`/os/${FACILITY_A}/dashboard`)
    await expect(page.getByRole("banner").first()).toContainText(/synapse e2e hospital/i)
    expect(page.url()).toContain(`/os/${FACILITY_A}`)
    expect(ids.patientId).toBe(PATIENT_ID)
    expect(ids.synapseId).toBe(SYNAPSE_ID)
    expect(ids.encounterId).toBe(encounterId)
  })
})
