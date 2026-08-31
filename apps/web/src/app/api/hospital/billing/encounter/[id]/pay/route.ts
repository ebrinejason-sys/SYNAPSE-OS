import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  recordEncounterPayment,
  recordPaymentRecordedEvent,
} from '@synapse/db/clinical-payment'
import { paymentRecordedTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import { persistDomainEventsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext, encounterPaymentSchema } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'payment', 'collect', 'billing')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'billing')
  if (moduleBlock) return moduleBlock

  const { id: encounterId } = await params
  const body = await req.json().catch(() => null)
  const parsed = encounterPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  try {
    const result = await recordEncounterPayment(db, {
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      encounterId,
      amount: parsed.data.amount,
      paymentMethod: parsed.data.payment_method,
      paymentRef: parsed.data.payment_ref ?? null,
      idempotencyKey: parsed.data.idempotency_key ?? null,
      receivedBy: ctx.userId,
      notes: parsed.data.notes ?? null,
    })

    if (result.created) {
      const { data: invoiceRow } = await db
        .from('billing_invoices')
        .select('patient_id')
        .eq('id', result.invoiceId)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle()

      const patientId = invoiceRow?.patient_id ? String(invoiceRow.patient_id) : null
      const outbox = recordPaymentRecordedEvent({
        tenantId: ctx.tenantId,
        hospitalId: ctx.hospitalId,
        patientId,
        encounterId,
        invoiceId: result.invoiceId,
        paymentId: result.paymentId,
        amount: result.amount,
        paymentMethod: parsed.data.payment_method,
        receiptNumber: result.receiptNumber,
        actorId: ctx.userId,
      })
      await persistDomainEventsBestEffort(db, outbox.list({ correlationId: encounterId }))

      if (patientId) {
        void publishClinicalTimelineBestEffort(
          publishTimelineEvent,
          paymentRecordedTimelineEvent({
            tenantId: ctx.tenantId,
            hospitalId: ctx.hospitalId,
            patientId,
            encounterId,
            amount: result.amount,
            receiptNumber: result.receiptNumber,
            paymentMethod: parsed.data.payment_method,
            createdBy: ctx.userId,
          }),
        )
      }

      await logHospitalAudit({
        ctx,
        action: 'INSERT',
        tableName: 'billing_payments',
        recordId: result.paymentId,
        newValue: {
          invoice_id: result.invoiceId,
          amount: result.amount,
          receipt_number: result.receiptNumber,
        },
      })
    }

    return NextResponse.json({ payment: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'payment_failed'
    const status =
      message === 'INVOICE_NOT_FOUND'
        ? 404
        : message === 'INVOICE_ALREADY_PAID' || message === 'AMOUNT_EXCEEDS_BALANCE'
          ? 409
          : 400
    return NextResponse.json({ error: message }, { status })
  }
}
