import { supabaseAdmin } from "./admin"
import { pharmacyDomainError, type PharmacyDomainError } from "./errors"
import {
  canOpenTill,
  expectedCash,
  isOpenTillStatus,
  statusAfterSale,
  validateClose,
  type TillStatus,
  type TillTotals,
} from "./cashier-session"
import { toPharmacyAuditInsert } from "./audit-contract"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

export type TillSessionRow = {
  id: string
  tenant_id: string
  store_id: string | null
  cashier_id: string
  status: TillStatus
  opening_float: number
  closing_float: number | null
  cash_in: number
  cash_out: number
  cash_payment_total: number
  cash_refund_total: number
  expected_cash: number | null
  counted_cash: number | null
  cash_variance: number | null
  variance_reason: string | null
  notes: string | null
  device_id: string | null
  opened_by: string | null
  closed_by: string | null
  opened_at: string
  closed_at: string | null
}

function fail(code: string, message: string): PharmacyDomainError {
  return pharmacyDomainError(code, message)
}

function totalsFrom(row: TillSessionRow): TillTotals {
  return {
    openingFloat: Number(row.opening_float ?? 0),
    cashPaymentTotal: Number(row.cash_payment_total ?? 0),
    cashRefundTotal: Number(row.cash_refund_total ?? 0),
    cashIn: Number(row.cash_in ?? 0),
    cashOut: Number(row.cash_out ?? 0),
  }
}

export function presentTill(row: TillSessionRow) {
  const totals = totalsFrom(row)
  const expected = expectedCash(totals)
  return {
    id: row.id,
    tenantId: row.tenant_id,
    storeId: row.store_id,
    cashierId: row.cashier_id,
    status: row.status,
    openingFloat: totals.openingFloat,
    cashPaymentTotal: totals.cashPaymentTotal,
    cashRefundTotal: totals.cashRefundTotal,
    cashIn: totals.cashIn,
    cashOut: totals.cashOut,
    expectedCash: expected,
    countedCash: row.counted_cash == null ? null : Number(row.counted_cash),
    variance: row.cash_variance == null ? null : Number(row.cash_variance),
    varianceReason: row.variance_reason,
    notes: row.notes,
    deviceId: row.device_id,
    openedBy: row.opened_by,
    closedBy: row.closed_by,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  }
}

export async function getOpenTill(params: {
  tenantId: string
  cashierId: string
}): Promise<TillSessionRow | null> {
  const { data } = await db
    .from("pharmacy_cashier_sessions")
    .select("*")
    .eq("tenant_id", params.tenantId)
    .eq("cashier_id", params.cashierId)
    .in("status", ["open", "active", "closing"])
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as TillSessionRow | null) ?? null
}

export async function openTill(params: {
  tenantId: string
  cashierId: string
  storeId?: string | null
  openingFloat: number
  deviceId?: string | null
  tillCode?: string | null
}): Promise<{ ok: true; session: ReturnType<typeof presentTill> } | { ok: false; error: PharmacyDomainError }> {
  if (!Number.isFinite(params.openingFloat) || params.openingFloat < 0) {
    return { ok: false, error: fail("INVALID_QUANTITY", "Opening float must be zero or greater.") }
  }
  const existing = await getOpenTill({ tenantId: params.tenantId, cashierId: params.cashierId })
  const gate = canOpenTill(Boolean(existing))
  if (!gate.ok) {
    return { ok: false, error: fail(gate.code, "A till is already open for this cashier.") }
  }

  const { data, error } = await db
    .from("pharmacy_cashier_sessions")
    .insert({
      tenant_id: params.tenantId,
      cashier_id: params.cashierId,
      store_id: params.storeId ?? null,
      opening_float: params.openingFloat,
      status: "open",
      opened_by: params.cashierId,
      device_id: params.deviceId ?? null,
      till_code: params.tillCode ?? null,
    })
    .select("*")
    .single()

  if (error || !data) {
    return { ok: false, error: fail("UNKNOWN", error?.message ?? "Failed to open till.") }
  }

  await writeAudit({
    tenantId: params.tenantId,
    actorId: params.cashierId,
    action: "TILL_OPEN",
    entityId: data.id,
    storeId: params.storeId ?? null,
    result: "ok",
    details: { openingFloat: params.openingFloat },
  })

  return { ok: true, session: presentTill(data as TillSessionRow) }
}

export async function recordCashMovement(params: {
  tenantId: string
  cashierId: string
  sessionId: string
  kind: "in" | "out"
  amount: number
  reason?: string | null
}): Promise<{ ok: true; session: ReturnType<typeof presentTill> } | { ok: false; error: PharmacyDomainError }> {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return { ok: false, error: fail("INVALID_QUANTITY", "Amount must be greater than zero.") }
  }
  const row = await getSessionForCashier(params)
  if (!row.ok) return row
  if (!isOpenTillStatus(row.session.status) || row.session.status === "closing") {
    return { ok: false, error: fail("TILL_NOT_OPEN", "Till is not accepting cash movements.") }
  }
  const patch =
    params.kind === "in"
      ? { cash_in: Number(row.session.cash_in) + params.amount }
      : { cash_out: Number(row.session.cash_out) + params.amount }
  const { data, error } = await db
    .from("pharmacy_cashier_sessions")
    .update(patch)
    .eq("id", params.sessionId)
    .eq("tenant_id", params.tenantId)
    .select("*")
    .single()
  if (error || !data) {
    return { ok: false, error: fail("UNKNOWN", error?.message ?? "Failed to record cash movement.") }
  }
  return { ok: true, session: presentTill(data as TillSessionRow) }
}

export async function attachSaleToTill(params: {
  tenantId: string
  cashierId: string
  paymentMethod: string
  amount: number
  kind: "sale" | "refund"
  required?: boolean
}): Promise<{ ok: true; sessionId: string | null } | { ok: false; error: PharmacyDomainError }> {
  const open = await getOpenTill({ tenantId: params.tenantId, cashierId: params.cashierId })
  if (!open) {
    if (params.required === false) return { ok: true, sessionId: null }
    return { ok: false, error: fail("TILL_NOT_OPEN", "Open a till before completing this sale.") }
  }
  if (open.status !== "open" && open.status !== "active") {
    return { ok: false, error: fail("TILL_NOT_OPEN", "Till is closing or closed.") }
  }
  const method = params.paymentMethod.trim().toLowerCase()
  const cash = method === "cash"
  const nextStatus = statusAfterSale(open.status)
  const patch: Record<string, unknown> = { status: nextStatus }
  if (cash && params.kind === "sale") {
    patch.cash_payment_total = Number(open.cash_payment_total) + params.amount
  }
  if (cash && params.kind === "refund") {
    patch.cash_refund_total = Number(open.cash_refund_total) + params.amount
  }
  await db.from("pharmacy_cashier_sessions").update(patch).eq("id", open.id).eq("tenant_id", params.tenantId)
  return { ok: true, sessionId: open.id }
}

export async function closeTill(params: {
  tenantId: string
  cashierId: string
  sessionId: string
  countedCash: number
  varianceReason?: string | null
  notes?: string | null
  closerId?: string
  allowOtherCashier?: boolean
}): Promise<{ ok: true; session: ReturnType<typeof presentTill> } | { ok: false; error: PharmacyDomainError }> {
  const row = await getSessionForCashier({
    tenantId: params.tenantId,
    cashierId: params.cashierId,
    sessionId: params.sessionId,
    allowOtherCashier: params.allowOtherCashier === true,
  })
  if (!row.ok) return row
  const verdict = validateClose({
    status: row.session.status,
    countedCash: params.countedCash,
    varianceReason: params.varianceReason,
    totals: totalsFrom(row.session),
  })
  if (!verdict.ok) {
    const messages: Record<string, string> = {
      TILL_NOT_OPEN: "Till is not open.",
      TILL_ALREADY_CLOSED: "Till is already closed.",
      TILL_VARIANCE_REQUIRES_REASON: "Record a reason for the cash variance.",
      INVALID_QUANTITY: "Counted cash must be zero or greater.",
    }
    return { ok: false, error: fail(verdict.code, messages[verdict.code] ?? verdict.code) }
  }

  const { data, error } = await db
    .from("pharmacy_cashier_sessions")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: params.closerId ?? params.cashierId,
      closing_float: params.countedCash,
      counted_cash: params.countedCash,
      expected_cash: verdict.expectedCash,
      cash_variance: verdict.variance,
      variance_reason: params.varianceReason?.trim() || null,
      notes: params.notes ?? row.session.notes,
    })
    .eq("id", params.sessionId)
    .eq("tenant_id", params.tenantId)
    .in("status", ["open", "active", "closing"])
    .select("*")
    .single()

  if (error || !data) {
    return { ok: false, error: fail("TILL_ALREADY_CLOSED", "Till could not be closed (already closed?).") }
  }

  await writeAudit({
    tenantId: params.tenantId,
    actorId: params.closerId ?? params.cashierId,
    action: "TILL_CLOSE",
    entityId: params.sessionId,
    storeId: data.store_id,
    result: "ok",
    details: {
      expectedCash: verdict.expectedCash,
      countedCash: params.countedCash,
      variance: verdict.variance,
      varianceReason: params.varianceReason ?? null,
    },
  })

  return { ok: true, session: presentTill(data as TillSessionRow) }
}

async function getSessionForCashier(params: {
  tenantId: string
  cashierId: string
  sessionId: string
  allowOtherCashier?: boolean
}): Promise<{ ok: true; session: TillSessionRow } | { ok: false; error: PharmacyDomainError }> {
  const { data } = await db
    .from("pharmacy_cashier_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle()
  if (!data) return { ok: false, error: fail("TILL_NOT_OPEN", "Till session not found.") }
  if (!params.allowOtherCashier && data.cashier_id !== params.cashierId) {
    return { ok: false, error: fail("ACCESS_DENIED", "This till belongs to another cashier.") }
  }
  return { ok: true, session: data as TillSessionRow }
}

async function writeAudit(event: {
  tenantId: string
  actorId: string
  action: "TILL_OPEN" | "TILL_CLOSE"
  entityId: string
  storeId: string | null
  result: "ok" | "failed"
  details?: Record<string, unknown>
}) {
  try {
    await db.from("pharmacy_audit_logs").insert(
      toPharmacyAuditInsert({
        action: event.action,
        tenantId: event.tenantId,
        actorId: event.actorId,
        storeId: event.storeId,
        entity: "pharmacy_cashier_sessions",
        entityId: event.entityId,
        result: event.result,
        details: event.details,
      }),
    )
  } catch {
    // Audit must never block the till mutation.
  }
}
