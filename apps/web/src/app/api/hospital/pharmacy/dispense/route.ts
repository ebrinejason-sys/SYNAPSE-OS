import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { ExchangeOutbox } from '@synapse/db/exchange'
import { verifyPrescription, dispensePrescription } from '@synapse/db/prescription-bridge'
import { rowToClinicalPrescription, persistClinicalPrescriptionBestEffort } from '@synapse/db/prescription-persist'
import { persistDomainEventsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, hospitalDispenseSchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'prescription', 'dispense', 'dispensing')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'dispensing')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = hospitalDispenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { prescription_id, product_id, pharmacy_tenant_id, payment_method } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: row, error: loadError } = await db
    .from('clinical_prescriptions')
    .select('*')
    .eq('id', prescription_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })

  const current = rowToClinicalPrescription(row as Record<string, unknown>)
  if (current.status === 'dispensed') {
    return NextResponse.json({ error: 'Already dispensed' }, { status: 409 })
  }

  const { data: product, error: productError } = await db
    .from('pharmacy_products')
    .select('id, price, name, is_active')
    .eq('id', product_id)
    .eq('tenant_id', pharmacy_tenant_id)
    .maybeSingle()

  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
  if (!product?.is_active) {
    return NextResponse.json({ error: 'Product not found or inactive' }, { status: 400 })
  }

  const { data: stockRows } = await db
    .from('pharmacy_stock')
    .select('quantity')
    .eq('tenant_id', pharmacy_tenant_id)
    .eq('product_id', product_id)

  const availableStock = (stockRows ?? []).reduce(
    (sum: number, row: { quantity?: number }) => sum + Number(row.quantity ?? 0),
    0,
  )

  try {
    const verified =
      current.status === 'verified'
        ? current
        : verifyPrescription(current, ctx.userId, ctx.role)

    const dispensed = dispensePrescription({
      rx: verified,
      dispenserId: ctx.userId,
      role: ctx.role,
      availableStock,
    })

    const idempotencyKey = `clinical_prescriptions:${prescription_id}`
    const { data: sale, error: saleError } = await db.rpc('complete_pharmacy_sale', {
      p_tenant_id: pharmacy_tenant_id,
      p_cashier_id: ctx.userId,
      p_items: [
        {
          product_id,
          quantity: dispensed.rx.quantity,
          unit_price: Number(product.price ?? 0),
          discount_amount: 0,
        },
      ],
      p_payment_method: payment_method,
      p_session_id: null,
      p_cart_id: null,
      p_payment_ref: null,
      p_discount_total: 0,
      p_tax_amount: 0,
      p_patient_id: dispensed.rx.patientId,
      p_confirmed_by: ctx.userId,
      p_idempotency_key: idempotencyKey,
    })

    if (saleError) {
      return NextResponse.json({ error: saleError.message }, { status: 400 })
    }

    const saleId =
      sale && typeof sale === 'object'
        ? String((sale as Record<string, unknown>).sale_id ?? (sale as Record<string, unknown>).id ?? '')
        : null

    const outbox = new ExchangeOutbox()
    outbox.append({
      eventType: 'PrescriptionVerified',
      tenantId: ctx.tenantId,
      facilityId: ctx.hospitalId,
      patientId: dispensed.rx.patientId,
      encounterId: dispensed.rx.encounterId,
      actorId: ctx.userId,
      source: 'synapse-pharm',
      aggregateId: dispensed.rx.id,
      action: 'verify',
      correlationId: dispensed.rx.correlationId,
      payload: { prescription_id: dispensed.rx.id, medication_display: dispensed.rx.medicationDisplay },
      isSynthetic: dispensed.rx.isSynthetic,
      simulationRunId: dispensed.rx.simulationRunId ?? null,
    })
    outbox.append({
      eventType: 'MedicationDispensed',
      tenantId: ctx.tenantId,
      facilityId: ctx.hospitalId,
      patientId: dispensed.rx.patientId,
      encounterId: dispensed.rx.encounterId,
      actorId: ctx.userId,
      source: 'synapse-pharm',
      aggregateId: dispensed.rx.id,
      action: 'dispense',
      correlationId: dispensed.rx.correlationId,
      payload: {
        prescription_id: dispensed.rx.id,
        product_id,
        quantity: dispensed.rx.quantity,
        sale_id: saleId,
      },
      isSynthetic: dispensed.rx.isSynthetic,
      simulationRunId: dispensed.rx.simulationRunId ?? null,
    })

    const updatedRx = {
      ...dispensed.rx,
      pharmacyTenantId: pharmacy_tenant_id,
    }
    await persistClinicalPrescriptionBestEffort(db, updatedRx)
    await db
      .from('clinical_prescriptions')
      .update({
        pharmacy_order_id: saleId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prescription_id)
      .eq('tenant_id', ctx.tenantId)

    const { data: taskRow } = await db
      .from('department_tasks')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .eq('source_resource', 'clinical_prescriptions')
      .eq('source_id', prescription_id)
      .eq('task_type', 'prescription')
      .maybeSingle()

    if (taskRow) {
      await db
        .from('department_tasks')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          result_summary: `Dispensed via sale ${saleId ?? 'unknown'}`,
        })
        .eq('id', taskRow.id)
    }

    await persistDomainEventsBestEffort(db, outbox.list({ correlationId: dispensed.rx.correlationId }))

    await logHospitalAudit({
      ctx,
      action: 'UPDATE',
      tableName: 'clinical_prescriptions',
      recordId: prescription_id,
      newValue: { status: 'dispensed', sale_id: saleId, product_id },
    })

    return NextResponse.json({
      prescription: updatedRx,
      sale,
      remainingStock: dispensed.remainingStock,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dispense failed' },
      { status: 400 },
    )
  }
}
