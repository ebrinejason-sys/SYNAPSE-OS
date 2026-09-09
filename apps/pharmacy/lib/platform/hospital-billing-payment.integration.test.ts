import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@synapse/db/admin'
import { appendClinicalCharge } from '@synapse/db/clinical-charge'
import { recordEncounterPayment } from '@synapse/db/clinical-payment'
import { hasDb } from './test-db-guard'

describe.skipIf(!hasDb)('hospital billing payment (P1-008)', () => {
  let tenantId: string
  let patientId: string
  let encounterId: string

  beforeAll(async () => {
    tenantId = crypto.randomUUID()
    patientId = crypto.randomUUID()
    encounterId = crypto.randomUUID()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any

    const { error: tenantError } = await db.from('tenants').insert({
      id: tenantId,
      slug: tenantId,
      name: 'Billing Payment Test Hospital',
      facility_type: 'hospital',
      is_synthetic: true,
      environment: 'demo',
      data_classification: 'synthetic',
    })
    if (tenantError) throw new Error(tenantError.message)

    const { error: patientError } = await db.from('patients').insert({
      id: patientId,
      tenant_id: tenantId,
      mrn: `PAY-${Date.now()}`,
      full_name: 'Test Payer',
      dob: '1992-03-10',
      sex: 'M',
    })
    if (patientError) throw new Error(patientError.message)

    const { error: encounterError } = await db.from('encounters').insert({
      id: encounterId,
      tenant_id: tenantId,
      patient_id: patientId,
      chief_complaint: 'Billing payment probe',
      status: 'open',
      visit_date: new Date().toISOString(),
      is_deleted: false,
      is_synthetic: true,
    })
    if (encounterError) throw new Error(encounterError.message)

    await appendClinicalCharge(db, {
      tenantId,
      patientId,
      encounterId,
      itemName: 'Consultation',
      unitPrice: 10000,
      qty: 1,
      sourceTable: 'encounters',
      sourceId: encounterId,
      createdBy: undefined,
    })
  })

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    await db.from('billing_payments').delete().eq('tenant_id', tenantId)
    await db.from('billing_line_items').delete().eq('tenant_id', tenantId)
    await db.from('billing_invoices').delete().eq('tenant_id', tenantId)
    await db.from('encounters').delete().eq('tenant_id', tenantId)
    await db.from('patients').delete().eq('tenant_id', tenantId)
    await db.from('tenants').delete().eq('id', tenantId)
  })

  it('records payment and marks invoice paid with idempotent retry', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    const idempotencyKey = `test-pay:${encounterId}`

    const first = await recordEncounterPayment(db, {
      tenantId,
      hospitalId: tenantId,
      encounterId,
      amount: 10000,
      paymentMethod: 'cash',
      idempotencyKey,
      receivedBy: undefined,
    })

    expect(first.created).toBe(true)
    expect(first.status).toBe('paid')
    expect(first.paidAmount).toBe(10000)
    expect(first.balanceDue).toBe(0)

    const second = await recordEncounterPayment(db, {
      tenantId,
      hospitalId: tenantId,
      encounterId,
      amount: 10000,
      paymentMethod: 'cash',
      idempotencyKey,
      receivedBy: undefined,
    })

    expect(second.created).toBe(false)
    expect(second.paymentId).toBe(first.paymentId)

    const { data: payments } = await db
      .from('billing_payments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', first.invoiceId)

    expect((payments ?? []).length).toBe(1)
  })
})
