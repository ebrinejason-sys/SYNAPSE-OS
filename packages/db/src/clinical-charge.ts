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

export const SERVICE_PRICE_NOT_CONFIGURED = "SERVICE_PRICE_NOT_CONFIGURED"

function money(value: number): number {
  return Math.round(Number(value) * 100) / 100
}

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
): Promise<number | null> {
  const { data: exact } = await db
    .from("service_catalog")
    .select("price")
    .eq("tenant_id", tenantId)
    .eq("service_type", serviceType)
    .ilike("name", `%${nameHint}%`)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (exact?.price != null) return money(Number(exact.price))

  return null
}

async function findEncounterInvoice(
  db: DbClient,
  tenantId: string,
  encounterId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db
    .from("billing_invoices")
    .select("id, total_amount, status, currency")
    .eq("tenant_id", tenantId)
    .eq("encounter_id", encounterId)
    .eq("is_deleted", false)
    .neq("status", "void")
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
    .eq("is_deleted", false)

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
  const unitPrice = money(input.unitPrice)
  const lineTotal = money(unitPrice * qty)

  let invoice = await findEncounterInvoice(db, tenantId, encounterId)
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

  const status = String(invoice!.status ?? "draft")
  if (status === "paid" || status === "void") {
    throw new Error("INVOICE_LOCKED")
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
      is_deleted: false,
    })
    .select("id")
    .single()

  if (lineError) throw new Error(lineError.message)

  const newTotal = money(Number(invoice!.total_amount ?? 0) + lineTotal)
  const { error: updateError } = await db
    .from("billing_invoices")
    .update({
      total_amount: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)

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

export type MaterializeEncounterChargesInput = {
  tenantId: string
  encounterId: string
}

export type MaterializeEncounterChargesResult = {
  encounterFound: boolean
  patientId: string | null
  invoiceId: string | null
  warnings: string[]
}

async function chargeIfPriced(
  db: DbClient,
  params: {
    tenantId: string
    patientId: string
    encounterId: string
    itemName: string
    unitPrice: number | null
    qty?: number
    sourceTable: string
    sourceId: string
    warnings: string[]
  },
): Promise<string | null> {
  if (params.unitPrice == null) {
    params.warnings.push(`${SERVICE_PRICE_NOT_CONFIGURED}:${params.sourceTable}:${params.sourceId}`)
    return null
  }
  const result = await appendClinicalChargeBestEffort(db, {
    tenantId: params.tenantId,
    patientId: params.patientId,
    encounterId: params.encounterId,
    itemName: params.itemName,
    unitPrice: params.unitPrice,
    qty: params.qty,
    sourceTable: params.sourceTable,
    sourceId: params.sourceId,
  })
  if (!result.ok) {
    if (result.error !== "INVOICE_LOCKED") params.warnings.push(result.error)
    return null
  }
  return result.result.invoiceId
}

export async function materializeEncounterCharges(
  db: DbClient,
  input: MaterializeEncounterChargesInput,
): Promise<MaterializeEncounterChargesResult> {
  const tenantId = requireUuid(input.tenantId, "tenant_id")
  const encounterId = requireUuid(input.encounterId, "encounter_id")
  const warnings: string[] = []

  const { data: encounter, error: encounterError } = await db
    .from("encounters")
    .select("id, patient_id, tenant_id, is_signed, status")
    .eq("id", encounterId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (encounterError) throw new Error(encounterError.message)
  if (!encounter) {
    return { encounterFound: false, patientId: null, invoiceId: null, warnings }
  }

  const patientId = String(encounter.patient_id)
  let invoiceId: string | null = null

  if (encounter.is_signed || encounter.status === "completed") {
    const consultPrice = await resolveServicePrice(db, tenantId, "consultation", "OPD")
    invoiceId =
      (await chargeIfPriced(db, {
        tenantId,
        patientId,
        encounterId,
        itemName: "OPD Consultation",
        unitPrice: consultPrice,
        sourceTable: "encounters",
        sourceId: encounterId,
        warnings,
      })) ?? invoiceId
  }

  const { data: labOrders, error: labError } = await db
    .from("lab_orders")
    .select("id, test_name")
    .eq("tenant_id", tenantId)
    .eq("encounter_id", encounterId)
  if (labError) throw new Error(labError.message)
  for (const order of (labOrders as Array<{ id: string; test_name: string }> | null) ?? []) {
    const price = await resolveServicePrice(db, tenantId, "lab", String(order.test_name))
    invoiceId =
      (await chargeIfPriced(db, {
        tenantId,
        patientId,
        encounterId,
        itemName: `Lab · ${order.test_name}`,
        unitPrice: price,
        sourceTable: "lab_orders",
        sourceId: String(order.id),
        warnings,
      })) ?? invoiceId
  }

  const { data: prescriptions, error: rxError } = await db
    .from("clinical_prescriptions")
    .select("id, medication_display, quantity, status, pharmacy_order_id")
    .eq("tenant_id", tenantId)
    .eq("encounter_id", encounterId)
  if (rxError) throw new Error(rxError.message)

  const { data: products } = await db
    .from("pharmacy_products")
    .select("name, price")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)

  for (const rx of (prescriptions as Array<Record<string, unknown>> | null) ?? []) {
    const dispensed = String(rx.status ?? "") === "dispensed" || rx.pharmacy_order_id
    if (!dispensed) continue
    const display = String(rx.medication_display ?? "")
    const product = ((products as Array<{ name: string; price: number | null }> | null) ?? []).find(
      (row) =>
        display.toLowerCase().includes(String(row.name).toLowerCase()) ||
        String(row.name).toLowerCase().includes(display.toLowerCase()),
    )
    const unitPrice = product?.price == null ? null : money(Number(product.price))
    invoiceId =
      (await chargeIfPriced(db, {
        tenantId,
        patientId,
        encounterId,
        itemName: `Dispense · ${display}`,
        unitPrice,
        qty: Number(rx.quantity ?? 1),
        sourceTable: "pharmacy_dispense",
        sourceId: String(rx.id),
        warnings,
      })) ?? invoiceId
  }

  if (!invoiceId) {
    const existing = await findEncounterInvoice(db, tenantId, encounterId)
    invoiceId = existing ? String(existing.id) : null
  }

  return { encounterFound: true, patientId, invoiceId, warnings }
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
