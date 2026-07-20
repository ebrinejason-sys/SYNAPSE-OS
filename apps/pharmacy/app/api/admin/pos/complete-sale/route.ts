import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin } from "@/lib/auth"
import { gateFeature } from "@synapse/auth/features"
import { supabaseAdmin } from "@/lib/supabase/admin"

type SaleItemIn = {
  productId: string
  quantity: number
  /** Catalog / locked unit price at sale time */
  listPrice: number
  /** Sold unit price after discount (per base unit) */
  unitPrice: number
  discountAmount?: number
  discountReason?: string | null
  discountApprovedBy?: string | null
  batchId?: string | null
}

/**
 * Complete a POS sale via live `complete_pharmacy_sale` RPC.
 * Server recomputes list prices from catalog; cashiers cannot invent prices.
 * Nonzero discount_amount requires discount_reason (DB constraint).
 */
export async function POST(request: NextRequest) {
  const session = await getPharmacySession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const tenantId = session.tenantId || session.profile.tenant_id
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 })

  const gate = await gateFeature(tenantId, "pos.sell")
  if (gate) return gate

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const itemsIn = Array.isArray(body.items) ? (body.items as SaleItemIn[]) : []
  if (itemsIn.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 })
  }

  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : ""
  if (!paymentMethod) {
    return NextResponse.json({ error: "paymentMethod is required" }, { status: 400 })
  }

  const cashierId =
    typeof body.staffId === "string" && body.staffId
      ? body.staffId
      : session.userId

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
    const quantity = Number(raw.quantity)
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Invalid cart item" }, { status: 400 })
    }

    const { data: product } = await db
      .from("pharmacy_products")
      .select("id, price, name, is_active")
      .eq("id", productId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (!product || product.is_active === false) {
      return NextResponse.json({ error: `Product not found: ${productId}` }, { status: 404 })
    }

    const listPrice = Number(product.price ?? 0)
    const requestedUnit = Number(raw.unitPrice)
    const discountAmount = Math.max(0, Number(raw.discountAmount ?? 0))
    const discountReason =
      typeof raw.discountReason === "string" && raw.discountReason.trim()
        ? raw.discountReason.trim()
        : null

    // Cashiers: sold price must equal list unless discount fields explain the gap.
    const soldPrice = Number.isFinite(requestedUnit) ? requestedUnit : listPrice
    const impliedDiscount = Math.max(0, (listPrice - soldPrice) * quantity)
    const lineDiscount = discountAmount > 0 ? discountAmount : impliedDiscount
    const effectiveSold =
      lineDiscount > 0 && quantity > 0
        ? Math.max(0, listPrice - lineDiscount / quantity)
        : listPrice

    if (!isPharmacyAdmin(session) && Math.abs(soldPrice - listPrice) > 0.0001 && lineDiscount <= 0) {
      return NextResponse.json(
        { error: "Cashiers cannot change unit price — use discount control" },
        { status: 403 },
      )
    }

    if (lineDiscount > 0 && !discountReason) {
      return NextResponse.json(
        { error: "discount_reason is required when discount_amount is nonzero" },
        { status: 400 },
      )
    }

    const discountPct =
      listPrice > 0 && quantity > 0 ? (lineDiscount / (listPrice * quantity)) * 100 : 0

    if (discountPct > threshold && !approvedBy && !isPharmacyAdmin(session)) {
      return NextResponse.json(
        {
          error: `Discount ${discountPct.toFixed(1)}% exceeds threshold ${threshold}% — supervisor approval required`,
          code: "DISCOUNT_APPROVAL_REQUIRED",
          threshold,
        },
        { status: 403 },
      )
    }

    rpcItems.push({
      product_id: productId,
      quantity,
      unit_price: effectiveSold,
      list_price: listPrice,
      discount_amount: lineDiscount,
      discount_reason: discountReason,
      discount_approved_by: approvedBy || (isPharmacyAdmin(session) ? session.userId : null),
      batch_id: raw.batchId ?? null,
    })
  }

  const discountTotal = rpcItems.reduce(
    (s, i) => s + Number(i.discount_amount ?? 0),
    0,
  )

  const { data, error } = await db.rpc("complete_pharmacy_sale", {
    p_tenant_id: tenantId,
    p_cashier_id: cashierId,
    p_items: rpcItems,
    p_payment_method: paymentMethod,
    p_session_id: body.sessionId ?? null,
    p_cart_id: body.cartId ?? null,
    p_payment_ref: body.paymentRef ?? null,
    p_discount_total: discountTotal,
    p_tax_amount: Number(body.taxAmount ?? 0),
    p_patient_id: body.patientId ?? null,
    p_confirmed_by: session.userId,
  })

  if (error) {
    const msg = error.message ?? "Sale failed"
    const status =
      msg.includes("EXPIRED_BATCH_BLOCKED") || msg.includes("INSUFFICIENT_STOCK")
        ? 409
        : msg.includes("APPEND_ONLY")
          ? 409
          : 500
    return NextResponse.json(
      {
        error: friendlySaleError(msg),
        code: extractCode(msg),
      },
      { status },
    )
  }

  return NextResponse.json({ ok: true, sale: data })
}

function extractCode(message: string): string | null {
  const m = message.match(/^([A-Z_]+):/)
  return m?.[1] ?? null
}

function friendlySaleError(message: string): string {
  if (message.includes("EXPIRED_BATCH_BLOCKED")) {
    return "That batch is expired and cannot be sold. Remove it from the cart and pick another batch."
  }
  if (message.includes("INSUFFICIENT_STOCK")) {
    return "Not enough stock on active (non-expired) batches for this sale."
  }
  if (message.includes("APPEND_ONLY")) {
    return "Completed sales cannot be edited."
  }
  return message
}
