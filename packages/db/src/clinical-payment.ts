/**
 * Encounter invoice payment collection (P1-008).
 */

import { ExchangeOutbox } from "./exchange"

export type EncounterPaymentInput = {
  tenantId: string
  hospitalId: string
  encounterId: string
  amount: number
  paymentMethod: string
  paymentRef?: string | null
  idempotencyKey?: string | null
  receivedBy?: string | null
  notes?: string | null
}

export type EncounterPaymentResult = {
  paymentId: string
  invoiceId: string
  receiptNumber: string
  amount: number
  paidAmount: number
  totalAmount: number
  balanceDue: number
  status: string
  created: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any

function kampalaReceiptSeq(): string {
  const d = new Date()
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "")
  const tail = Math.floor(Math.random() * 9000 + 1000)
  return `RCP-${ymd}-${tail}`
}

async function loadInvoiceForEncounter(
  db: DbClient,
  tenantId: string,
  encounterId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await db
    .from("billing_invoices")
    .select("id, patient_id, status, currency, total_amount, paid_amount, invoice_number")
    .eq("tenant_id", tenantId)
    .eq("encounter_id", encounterId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("INVOICE_NOT_FOUND")
  return data as Record<string, unknown>
}

export async function recordEncounterPayment(
  db: DbClient,
  input: EncounterPaymentInput,
): Promise<EncounterPaymentResult> {
  const invoice = await loadInvoiceForEncounter(db, input.tenantId, input.encounterId)
  const invoiceId = String(invoice.id)
  const totalAmount = Number(invoice.total_amount ?? 0)
  const currentPaid = Number(invoice.paid_amount ?? 0)
  const balanceDue = Math.max(0, totalAmount - currentPaid)

  if (balanceDue <= 0) throw new Error("INVOICE_ALREADY_PAID")
  if (input.amount <= 0) throw new Error("INVALID_AMOUNT")
  if (input.amount > balanceDue + 0.001) throw new Error("AMOUNT_EXCEEDS_BALANCE")

  const idempotencyKey = input.idempotencyKey?.trim() || null
  if (idempotencyKey) {
    const { data: existing, error: existingError } = await db
      .from("billing_payments")
      .select("id, amount, receipt_number")
      .eq("tenant_id", input.tenantId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (existingError) throw new Error(existingError.message)
    if (existing) {
      const paidAmount = currentPaid
      return {
        paymentId: String(existing.id),
        invoiceId,
        receiptNumber: String(existing.receipt_number ?? ""),
        amount: Number(existing.amount),
        paidAmount,
        totalAmount,
        balanceDue: Math.max(0, totalAmount - paidAmount),
        status: String(invoice.status ?? "draft"),
        created: false,
      }
    }
  }

  const paymentId = crypto.randomUUID()
  const receiptNumber = kampalaReceiptSeq()
  const currency = String(invoice.currency ?? "UGX")

  const { error: insertError } = await db.from("billing_payments").insert({
    id: paymentId,
    tenant_id: input.tenantId,
    invoice_id: invoiceId,
    encounter_id: input.encounterId,
    patient_id: invoice.patient_id ?? null,
    amount: input.amount,
    currency,
    payment_method: input.paymentMethod,
    payment_ref: input.paymentRef ?? null,
    receipt_number: receiptNumber,
    idempotency_key: idempotencyKey,
    received_by: input.receivedBy ?? null,
    notes: input.notes ?? null,
    is_deleted: false,
  })

  if (insertError) throw new Error(insertError.message)

  const newPaid = currentPaid + input.amount
  const newStatus =
    newPaid >= totalAmount - 0.001 ? "paid" : newPaid > 0 ? "partial_paid" : String(invoice.status ?? "draft")

  const { error: updateError } = await db
    .from("billing_invoices")
    .update({
      paid_amount: newPaid,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("tenant_id", input.tenantId)

  if (updateError) throw new Error(updateError.message)

  return {
    paymentId,
    invoiceId,
    receiptNumber,
    amount: input.amount,
    paidAmount: newPaid,
    totalAmount,
    balanceDue: Math.max(0, totalAmount - newPaid),
    status: newStatus,
    created: true,
  }
}

export function recordPaymentRecordedEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string | null
  encounterId: string
  invoiceId: string
  paymentId: string
  amount: number
  paymentMethod: string
  receiptNumber: string
  actorId?: string | null
  queue?: ExchangeOutbox
}): ExchangeOutbox {
  const outbox = params.queue ?? new ExchangeOutbox()
  outbox.append({
    eventType: "PaymentRecorded",
    tenantId: params.tenantId,
    facilityId: params.hospitalId,
    patientId: params.patientId,
    encounterId: params.encounterId,
    actorId: params.actorId ?? null,
    source: "synapse-os",
    aggregateId: params.paymentId,
    action: "collect",
    correlationId: params.encounterId,
    payload: {
      invoice_id: params.invoiceId,
      payment_id: params.paymentId,
      amount: params.amount,
      payment_method: params.paymentMethod,
      receipt_number: params.receiptNumber,
    },
    isSynthetic: false,
    simulationRunId: null,
  })
  return outbox
}

export async function recordEncounterPaymentBestEffort(
  db: DbClient,
  input: EncounterPaymentInput,
): Promise<{ ok: true; result: EncounterPaymentResult } | { ok: false; error: string }> {
  try {
    const result = await recordEncounterPayment(db, input)
    return { ok: true, result }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "payment failed" }
  }
}
