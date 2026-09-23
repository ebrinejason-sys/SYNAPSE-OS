import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import {
  mapAdjustmentEvent,
  mapPurchaseItemEvent,
  mapSaleItemEvent,
  withRunningBalances,
  type ProductHistoryEvent,
} from "@synapse/db/product-history"

const db = () => supabaseAdmin as any

/**
 * Tally-style product history: purchases, sales, physical/adjustments.
 * GET ?productId=
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission(["inventory.read", "purchasing.manage"])
    if (!auth.ok) return auth.response
    const { tenantId } = auth

    const productId = new URL(request.url).searchParams.get("productId")?.trim()
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 })
    }

    const { data: product, error: productError } = await db()
      .from("pharmacy_products")
      .select("id, name, sku, barcode, quantity, cost_price, price, unit_of_measure")
      .eq("tenant_id", tenantId)
      .eq("id", productId)
      .maybeSingle()

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const [purchaseRes, saleRes, adjRes] = await Promise.all([
      db()
        .from("pharmacy_purchase_items")
        .select(
          "id, quantity, unit_cost, selling_price, batch_number, created_at, purchase:pharmacy_purchases(id, purchase_no, purchase_date, created_at, tenant_id, status)",
        )
        .eq("product_id", productId)
        .order("created_at", { ascending: true })
        .limit(500),
      db()
        .from("pharmacy_pos_sale_items")
        .select(
          "id, quantity, unit_price, created_at, sale:pharmacy_pos_sales(id, receipt_number, created_at, confirmed_at, tenant_id, status)",
        )
        .eq("product_id", productId)
        .order("created_at", { ascending: true })
        .limit(500),
      db()
        .from("pharmacy_stock_adjustments")
        .select("id, quantity, type, reason, previous_qty, new_qty, created_at")
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .order("created_at", { ascending: true })
        .limit(500),
    ])

    const raw: ProductHistoryEvent[] = []
    for (const row of purchaseRes.data ?? []) {
      const purchase = (row as { purchase?: { tenant_id?: string } | null }).purchase
      if (!purchase || purchase.tenant_id !== tenantId) continue
      raw.push(mapPurchaseItemEvent(row as Parameters<typeof mapPurchaseItemEvent>[0]))
    }
    for (const row of saleRes.data ?? []) {
      const sale = (row as { sale?: { tenant_id?: string; status?: string } | null }).sale
      if (!sale || sale.tenant_id !== tenantId || sale.status !== "completed") continue
      raw.push(mapSaleItemEvent(row as Parameters<typeof mapSaleItemEvent>[0]))
    }
    for (const row of adjRes.data ?? []) {
      raw.push(mapAdjustmentEvent(row as Parameters<typeof mapAdjustmentEvent>[0]))
    }

    // Reconstruct opening from current book − sum of deltas.
    const netDelta = raw.reduce((sum, ev) => sum + ev.stockDelta, 0)
    const openingQty = Number(product.quantity ?? 0) - netDelta
    const events = withRunningBalances(raw, openingQty)

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        quantity: product.quantity,
        costPrice: product.cost_price,
        price: product.price,
        unitOfMeasure: product.unit_of_measure,
      },
      openingQty,
      events: events.reverse(), // newest first for UI
    })
  } catch (error) {
    console.error("Product history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
