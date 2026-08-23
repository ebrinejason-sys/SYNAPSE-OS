import { NextRequest, NextResponse } from "next/server"
import { isPharmacyAdmin } from "@/lib/auth"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { gateFeature } from "@synapse/auth/features"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  findSaleIdempotency,
  readIdempotencyKey,
  storeSaleIdempotency,
} from "@/lib/pos/idempotency"
import {
  extractSaleErrorCode,
  friendlySaleError,
  saleErrorHttpStatus,
  validateSaleLine,
  type SaleLineInput,
} from "@/lib/pos/sale-validation"
import { buildStockError, type StructuredStockError } from "@synapse/db/inventory"
import { pharmacyDispenseTimelineEvent } from "@synapse/db/timeline"
import { publishTimelineEvent } from "@synapse/db/identity-persist"
import { attachSaleToTill } from "@/lib/pos/till-service"
import { httpStatusForPharmacyError } from "@synapse/db/errors"
import { paymentStateForMethod } from "@synapse/db/cashier-session"

/**
 * Complete a POS sale via live `complete_pharmacy_sale` RPC.
 * Server recomputes list prices from catalog; cashiers cannot invent prices.
 * Cashier identity is always the authenticated session user.
 * Nonzero discount_amount requires discount_reason (DB constraint).
 * Optional Idempotency-Key prevents duplicate sales on retry.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePharmacyPermission("pos.sell")
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  const gate = await gateFeature(tenantId, "pos.sell")
  if (gate) return gate

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const idempotencyKey = readIdempotencyKey(request, body as Record<string, unknown>)
  if (idempotencyKey) {
    const prior = await findSaleIdempotency(tenantId, idempotencyKey)
    if (prior) {
      return NextResponse.json(
        { ok: true, sale: prior.response, idempotentReplay: true },
        { status: 200, headers: { "X-Idempotent-Replay": "true" } },
      )
    }
  }

  const itemsIn = Array.isArray(body.items) ? (body.items as SaleLineInput[]) : []
  if (itemsIn.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 })
  }

  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : ""
  if (!paymentMethod) {
    return NextResponse.json({ error: "paymentMethod is required" }, { status: 400 })
  }

  // Authenticated user is always the cashier. Client-supplied staffId is ignored.
  const cashierId = session.userId

  const db = supabaseAdmin as any

  const { data: settings } = await db
    .from("pharmacy_settings")
    .select("discount_approval_threshold_pct, vat_enabled, vat_rate, tax_rate")
    .eq("tenant_id", tenantId)
    .maybeSingle()

  const threshold = Number(settings?.discount_approval_threshold_pct ?? 5)
  const approvedBy =
    typeof body.discountApprovedBy === "string" && body.discountApprovedBy
      ? body.discountApprovedBy
      : null

  const rpcItems: Record<string, unknown>[] = []

  for (const raw of itemsIn) {
    const productId = String(raw.productId ?? "")
    const { data: product } = await db
      .from("pharmacy_products")
      .select("id, price, name, is_active")
      .eq("id", productId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    const validated = validateSaleLine({
      raw,
      product: product
        ? { id: product.id, price: Number(product.price ?? 0), is_active: product.is_active }
        : null,
      thresholdPct: threshold,
      isAdmin: isPharmacyAdmin(session),
      actorUserId: session.userId,
      approvedBy,
    })

    if (!validated.ok) {
      return NextResponse.json(
        {
          error: validated.error,
          ...(validated.code ? { code: validated.code } : {}),
          ...(validated.threshold != null ? { threshold: validated.threshold } : {}),
        },
        { status: validated.status },
      )
    }

    rpcItems.push(validated.rpcItem)
  }

  const saleAmount = rpcItems.reduce(
    (sum, item) =>
      sum +
      Number(item.unit_price ?? 0) * Number(item.quantity ?? 0) -
      Number(item.discount_amount ?? 0),
    0,
  )
  const till = await attachSaleToTill({
    tenantId,
    cashierId,
    paymentMethod,
    amount: saleAmount,
    kind: "sale",
  })
  if (!till.ok) {
    return NextResponse.json(till.error, { status: httpStatusForPharmacyError(till.error.code) })
  }
  const paymentState = paymentStateForMethod({
    method: paymentMethod,
    offline: false,
    providerConfirmed: paymentMethod.toLowerCase() === "cash",
  })
  void paymentState

  // Line discounts live on rpc items; p_discount_total must stay 0 or RPC double-counts.
  const { data, error } = await db.rpc("complete_pharmacy_sale", {
    p_tenant_id: tenantId,
    p_cashier_id: cashierId,
    p_items: rpcItems,
    p_payment_method: paymentMethod,
    p_session_id: till.sessionId,
    p_cart_id: body.cartId ?? null,
    p_payment_ref: body.paymentRef ?? null,
    p_discount_total: 0,
    p_tax_amount: Number(body.taxAmount ?? 0),
    p_patient_id: body.patientId ?? null,
    p_confirmed_by: session.userId,
    ...(idempotencyKey ? { p_idempotency_key: idempotencyKey } : {}),
  })

  if (error) {
    const msg = error.message ?? "Sale failed"
    const code = extractSaleErrorCode(msg)
    let stockError: StructuredStockError | null = null
    if (code === "INSUFFICIENT_STOCK" || code === "EXPIRED_BATCH_BLOCKED") {
      stockError = await buildPortalStockError(tenantId, rpcItems)
    }
    return NextResponse.json(
      {
        error: friendlySaleError(msg),
        code,
        ...(stockError ? { stockError } : {}),
      },
      { status: saleErrorHttpStatus(msg) },
    )
  }

  const responseBody = { ok: true as const, sale: data }
  if (idempotencyKey) {
    const saleId =
      data && typeof data === "object"
        ? String(
            (data as { sale_id?: unknown; id?: unknown }).sale_id ??
              (data as { id?: unknown }).id ??
              "",
          ) || null
        : null
    await storeSaleIdempotency({
      tenantId,
      key: idempotencyKey,
      userId: session.userId,
      saleId,
      response: data,
    })
  }

  void (async () => {
    try {
      const sale = data && typeof data === "object" ? (data as Record<string, unknown>) : {}
      const saleId = String(sale.sale_id ?? sale.id ?? "")
      if (!saleId) return
      const personId = typeof body.personId === "string" ? body.personId : null
      const patientId = typeof body.patientId === "string" ? body.patientId : null
      if (!personId && !patientId) return
      const names = rpcItems.map((i) => String(i.product_name ?? i.product_id)).slice(0, 4)
      await publishTimelineEvent(
        pharmacyDispenseTimelineEvent({
          tenantId,
          personId,
          patientId,
          siteId: typeof body.storeId === "string" ? body.storeId : null,
          saleId,
          receiptNumber: String(sale.receipt_number ?? ""),
          facilityName: session.tenantName,
          itemSummary: names.join(", "),
          createdBy: session.userId,
        }),
      )
    } catch (err) {
      console.error("[pos] timeline publish failed:", err)
    }
  })()

  // After sale, push if any sold product crossed below reorder
  void (async () => {
    try {
      const productIds = [...new Set(rpcItems.map((i) => String(i.product_id)))]
      if (productIds.length === 0) return
      const { data: products } = await db
        .from("pharmacy_products")
        .select("id, name, quantity, reorder_level")
        .eq("tenant_id", tenantId)
        .in("id", productIds)
      const low = (products ?? []).filter(
        (p: { quantity?: number; reorder_level?: number }) =>
          Number(p.reorder_level ?? 0) > 0 &&
          Number(p.quantity ?? 0) <= Number(p.reorder_level ?? 0),
      )
      if (low.length === 0) return
      const { notifyPharmacyStock } = await import("@synapse/auth/mobile-push")
      for (const p of low.slice(0, 5)) {
        notifyPharmacyStock({
          tenantId,
          productName: p.name,
          reason: "reorder",
          detail: `${p.name} is at ${p.quantity} (reorder ${p.reorder_level}).`,
        })
      }
    } catch (err) {
      console.error("[pos] reorder push failed:", err)
    }
  })()

  return NextResponse.json(responseBody)
}

/**
 * Recompute batch-derived stock for the requested lines and return the first line that
 * cannot be fully satisfied as a structured POS error. Best-effort (returns null on read failure).
 */
async function buildPortalStockError(
  tenantId: string,
  rpcItems: Record<string, unknown>[],
): Promise<StructuredStockError | null> {
  try {
    const db = supabaseAdmin as any
    const productIds = [...new Set(rpcItems.map((i) => String(i.product_id)))]
    if (productIds.length === 0) return null
    const { data: products } = await db
      .from("pharmacy_products")
      .select(
        `id, name, quantity, is_active,
         pharmacy_product_batches(id, batch_number, quantity, expiry_date, is_active, manufacturer)`,
      )
      .eq("tenant_id", tenantId)
      .in("id", productIds)

    const byId = new Map<string, any>()
    for (const p of products ?? []) byId.set(String(p.id), p)

    for (const item of rpcItems) {
      const pid = String(item.product_id)
      const product = byId.get(pid)
      const err = buildStockError({
        product: product
          ? { id: pid, name: String(product.name ?? ""), quantity: product.quantity, is_active: product.is_active }
          : { id: pid, name: "Unknown product", quantity: 0 },
        batches: product?.pharmacy_product_batches ?? [],
        requestedQuantity: Number(item.quantity ?? 0),
      })
      if (err) return err
    }
    return null
  } catch {
    return null
  }
}
