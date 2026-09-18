/**
 * Clinical activity → billing invoice bridge (P1-008).
 * Appends idempotent line items to a draft encounter invoice.
 */

import { ExchangeOutbox } from "./exchange"
import { optionalUuid, requireUuid } from "./identifiers"

export type ClinicalChargeInput = {
  tenantId: string
  patientId: string
  encounterId: string
  itemName: string
  unitPrice: number
  qty?: number
  currency?: string
  sourceTable: string
  sourceId: string
  createdBy?: string | null
}

export type ClinicalChargeResult = {
  invoiceId: string
  lineItemId: string
  created: boolean
  totalAmount: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any

const DEFAULT_LAB_CHARGE = 15000
const DEFAULT_CONSULTATION_CHARGE = 10000

function sourceNotes(sourceTable: string, sourceId: string): string {
  return JSON.stringify({ sourceTable, sourceId })
}

function parseSourceNotes(notes: unknown): { sourceTable?: string; sourceId?: string } | null {
  if (typeof notes !== "string" || !notes.startsWith("{")) return null
  try {
    return JSON.parse(notes) as { sourceTable?: string; sourceId?: string }
  } catch {
    return null
  }
}

export async function resolveServicePrice(
  db: DbClient,
  tenantId: string,
  serviceType: string,
  nameHint: string,
): Promise<number> {
  const { data: exact } = await db
    .from("service_catalog")
    .select("price")
    .eq("tenant_id", tenantId)
    .eq("service_type", serviceType)
    .ilike("name", `%${nameHint}%`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (exact?.price != null) return Number(exact.price)

  const { data: typed } = await db
    .from("service_catalog")
    .select("price")
    .eq("tenant_id", tenantId)
    .eq("service_type", serviceType)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (typed?.price != null) return Number(typed.price)

  if (serviceType === "lab") return DEFAULT_LAB_CHARGE
  if (serviceType === "consultation") return DEFAULT_CONSULTATION_CHARGE
  return 0
}

async function findDraftInvoice(
  db: DbClient,
  tenantId: string,
  encounterId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db
    .from("billing_invoices")
    .select("id, total_amount, status, currency")
    .eq("tenant_id", tenantId)
    .eq("encounter_id", encounterId)
    .in("status", ["draft", "open", "pending"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

async function findExistingLineItem(
  db: DbClient,
  tenantId: string,
  invoiceId: string,
  sourceTable: string,
  sourceId: string,
): Promise<Record<string, unknown> | null> {
  const { data: rows, error } = await db
    .from("billing_line_items")
    .select("id, total_price, notes")
    .eq("tenant_id", tenantId)
    .eq("invoice_id", invoiceId)

  if (error) throw new Error(error.message)
  for (const row of (rows as Record<string, unknown>[] | null) ?? []) {
    const src = parseSourceNotes(row.notes)
    if (src?.sourceTable === sourceTable && src?.sourceId === sourceId) {
      return row
    }
  }
  return null
}

export async function appendClinicalCharge(
  db: DbClient,
  input: ClinicalChargeInput,
): Promise<ClinicalChargeResult> {
  const tenantId = requireUuid(input.tenantId, "tenant_id")
  const patientId = requireUuid(input.patientId, "patient_id")
  const encounterId = requireUuid(input.encounterId, "encounter_id")
  optionalUuid(input.createdBy, "created_by")

  const qty = input.qty ?? 1
  const unitPrice = input.unitPrice
  const lineTotal = unitPrice * qty

  let invoice = await findDraftInvoice(db, tenantId, encounterId)
  let created = false

  if (!invoice) {
    const invoiceId = crypto.randomUUID()
    const { data: createdInvoice, error: createError } = await db
      .from("billing_invoices")
      .insert({
        id: invoiceId,
        tenant_id: tenantId,
        patient_id: patientId,
        encounter_id: encounterId,
        status: "draft",
        currency: input.currency ?? "UGX",
        total_amount: 0,
        paid_amount: 0,
        invoice_number: `INV-${encounterId.slice(0, 8).toUpperCase()}`,
        created_by: input.createdBy ?? null,
        is_deleted: false,
      })
      .select("id, total_amount, status, currency")
      .single()

    if (createError) throw new Error(createError.message)
    invoice = createdInvoice
    created = true
  }

  const invoiceId = String(invoice!.id)
  const existing = await findExistingLineItem(
    db,
    tenantId,
    invoiceId,
    input.sourceTable,
    input.sourceId,
  )

  if (existing) {
    return {
      invoiceId,
      lineItemId: String(existing.id),
      created: false,
      totalAmount: Number(invoice!.total_amount ?? 0),
    }
  }

  const lineItemId = crypto.randomUUID()
  const { data: lineItem, error: lineError } = await db
    .from("billing_line_items")
    .insert({
      id: lineItemId,
      tenant_id: tenantId,
      invoice_id: invoiceId,
      item_name: input.itemName,
      unit_price: unitPrice,
      qty,
      notes: sourceNotes(input.sourceTable, input.sourceId),
      created_by: input.createdBy ?? null,
      is_deleted: false,
    })
    .select("id")
    .single()

  if (lineError) throw new Error(lineError.message)

  const newTotal = Number(invoice!.total_amount ?? 0) + lineTotal
  const { error: updateError } = await db
    .from("billing_invoices")
    .update({
      total_amount: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)

  if (updateError) throw new Error(updateError.message)

  return {
    invoiceId,
    lineItemId: String(lineItem!.id ?? lineItemId),
    created,
    totalAmount: newTotal,
  }
}

export function recordInvoiceCreatedEvent(params: {
  tenantId: string
  hospitalId: string
  patientId: string
  encounterId: string
  invoiceId: string
  totalAmount: number
  actorId?: string | null
  queue?: ExchangeOutbox
}): ExchangeOutbox {
  const outbox = params.queue ?? new ExchangeOutbox()
  outbox.append({
    eventType: "InvoiceCreated",
    tenantId: params.tenantId,
    facilityId: params.hospitalId,
    patientId: params.patientId,
    encounterId: params.encounterId,
    actorId: params.actorId ?? null,
    source: "synapse-os",
    aggregateId: params.invoiceId,
    action: "create",
    correlationId: params.encounterId,
    payload: {
      invoice_id: params.invoiceId,
      total_amount: params.totalAmount,
    },
    isSynthetic: false,
    simulationRunId: null,
  })
  return outbox
}

export async function appendClinicalChargeBestEffort(
  db: DbClient,
  input: ClinicalChargeInput,
): Promise<{ ok: true; result: ClinicalChargeResult } | { ok: false; error: string }> {
  try {
    const result = await appendClinicalCharge(db, input)
    return { ok: true, result }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "charge failed" }
  }
}
