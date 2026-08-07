import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

/**
 * Stock adjustment — routes through the authoritative batch RPCs so Web never mutates
 * pharmacy_products.quantity directly:
 *   INCREASE  -> receive_pharmacy_stock (creates/tops up a real batch; requires batch + expiry)
 *   DECREASE  -> adjust_pharmacy_stock (FEFO deduction or a specific batch)
 *   CORRECTION-> compute delta vs current; decreases FEFO-deduct, increases require receiving
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("inventory.adjust")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { productId, quantity, type, reason, batchNumber, expiryDate, batchId, costPrice } =
      (await request.json()) as {
        productId: string
        quantity: number
        type: string
        reason?: string
        batchNumber?: string
        expiryDate?: string
        batchId?: string
        costPrice?: number
      }

    if (!productId || !quantity || !type) {
      return NextResponse.json(
        { error: "Product ID, quantity, and type are required" },
        { status: 400 },
      )
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: "A reason is required for stock adjustments" }, { status: 400 })
    }

    const { data: product } = await db
      .from("pharmacy_products")
      .select("id, name, quantity")
      .eq("tenant_id", tenantId)
      .eq("id", productId)
      .maybeSingle()
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    const current = Number(product.quantity ?? 0)

    if (type === "INCREASE") {
      if (!batchNumber || !expiryDate) {
        return NextResponse.json(
          { error: "Increasing stock requires a batch number and expiry date (goods receiving)." },
          { status: 400 },
        )
      }
      const { data, error } = await db.rpc("receive_pharmacy_stock", {
        p_tenant_id: tenantId,
        p_product_id: productId,
        p_batch_number: batchNumber,
        p_quantity: Math.trunc(Number(quantity)),
        p_expiry_date: expiryDate,
        p_cost_price: costPrice ?? null,
        p_received_by: session.user.id,
        p_supplier_ref: reason,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 409 })
      return NextResponse.json({ ok: true, received: data })
    }

    // DECREASE / CORRECTION → delta then adjust_pharmacy_stock.
    let delta: number
    if (type === "DECREASE") {
      delta = -Math.abs(Math.trunc(Number(quantity)))
    } else if (type === "CORRECTION") {
      const target = Math.max(0, Math.trunc(Number(quantity)))
      delta = target - current
      if (delta > 0) {
        return NextResponse.json(
          { error: "Correcting stock upward requires receiving a batch (batch number + expiry)." },
          { status: 400 },
        )
      }
      if (delta === 0) return NextResponse.json({ ok: true, unchanged: true })
    } else {
      return NextResponse.json({ error: "Invalid adjustment type" }, { status: 400 })
    }

    const { data, error } = await db.rpc("adjust_pharmacy_stock", {
      p_tenant_id: tenantId,
      p_product_id: productId,
      p_delta: delta,
      p_reason: reason,
      p_actor: session.user.id,
      p_batch_id: batchId ?? null,
      p_set_status: null,
    })
    if (error) {
      const status = error.message?.includes("INSUFFICIENT_STOCK") ? 409 : 500
      return NextResponse.json({ error: error.message }, { status })
    }
    return NextResponse.json({ ok: true, adjustment: data })
  } catch (error) {
    console.error("Stock update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
