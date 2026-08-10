import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

const db = () => supabaseAdmin as any

/**
 * GET /api/admin/inventory/reconciliation
 * Lists products whose product.quantity is not fully backed by batch rows.
 * Never fabricates batches — operators must receive genuine batch data.
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("inventory.read")
    if (!auth.ok) return auth.response
    const { tenantId } = auth

    const { data, error } = await db().rpc("report_unbatched_positive_stock", {
      p_tenant_id: tenantId,
    })

    if (error) {
      const { data: products } = await db()
        .from("pharmacy_products")
        .select("id, name, quantity")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .gt("quantity", 0)

      const rows = []
      for (const p of products ?? []) {
        const { data: batches } = await db()
          .from("pharmacy_product_batches")
          .select("quantity")
          .eq("tenant_id", tenantId)
          .eq("product_id", p.id)
        const physical = (batches ?? []).reduce(
          (s: number, b: { quantity: number }) => s + Number(b.quantity ?? 0),
          0,
        )
        const unbatched = Math.max(0, Number(p.quantity ?? 0) - physical)
        if (unbatched > 0) {
          rows.push({
            productId: p.id,
            name: p.name,
            productQuantity: p.quantity,
            physicalQuantity: physical,
            unbatchedQuantity: unbatched,
          })
        }
      }
      return NextResponse.json({
        items: rows,
        source: "fallback",
        note: "Receive each product with a genuine batch number, quantity, and expiry before it can be sold. Do not fabricate batches.",
      })
    }

    return NextResponse.json({
      items: (data ?? []).map((r: any) => ({
        productId: r.product_id,
        name: r.name,
        productQuantity: r.product_quantity,
        physicalQuantity: r.physical_quantity,
        unbatchedQuantity: r.unbatched_quantity,
      })),
      source: "report_unbatched_positive_stock",
      note: "These quantities are NOT sellable until received with genuine batch data. Do not fabricate batches.",
    })
  } catch (error) {
    console.error("Reconciliation report error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
