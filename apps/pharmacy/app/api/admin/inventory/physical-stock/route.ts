import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { setPharmacyPhysicalStock } from "@synapse/db/inventory-rpc"

const db = () => supabaseAdmin as any

/**
 * Tally Physical Stock — set absolute counted quantity (may be negative).
 * POST { productId, physicalQty, reason }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("inventory.adjust")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const body = (await request.json().catch(() => ({}))) as {
      productId?: string
      physicalQty?: number
      reason?: string
    }

    const productId = String(body.productId ?? "").trim()
    const physicalQty = Number(body.physicalQty)
    const reason = String(body.reason ?? "").trim() || "Physical stock count"

    if (!productId || !Number.isFinite(physicalQty)) {
      return NextResponse.json(
        { error: "productId and physicalQty are required" },
        { status: 400 },
      )
    }

    const { data: product } = await db()
      .from("pharmacy_products")
      .select("id, name, quantity")
      .eq("tenant_id", tenantId)
      .eq("id", productId)
      .maybeSingle()

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const { data, error } = await setPharmacyPhysicalStock(db(), {
      tenantId,
      productId,
      physicalQty: Math.trunc(physicalQty),
      reason,
      actorId: session.user.id,
    })

    if (error) {
      return NextResponse.json(
        { error: error.humanMessage, code: error.code, detail: error.message },
        { status: 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      product: { id: productId, name: product.name, quantity: data?.newQty },
      adjustment: data,
    })
  } catch (error) {
    console.error("Physical stock error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
