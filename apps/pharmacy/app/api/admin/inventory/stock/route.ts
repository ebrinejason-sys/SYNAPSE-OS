import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("inventory.adjust")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    const { productId, quantity, type, reason, batchNumber, expiryDate } =
      (await request.json()) as {
        productId: string
        quantity: number
        type: string
        reason?: string
        batchNumber?: string
        expiryDate?: string
      }

    if (!productId || !quantity || !type) {
      return NextResponse.json(
        { error: "Product ID, quantity, and type are required" },
        { status: 400 }
      )
    }

    // Fetch product (scoped to tenant)
    const { data: product } = await (supabaseAdmin as any)
      .from("pharmacy_products")
      .select("id, name, quantity, batch_number, expiry_date, reorder_level")
      .eq("tenant_id", tenantId)
      .eq("id", productId)
      .maybeSingle()

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const previousQty: number = product.quantity ?? 0
    const reorderLevel = Number(product.reorder_level ?? 0)
    let newQty: number

    if (type === "INCREASE") {
      newQty = previousQty + quantity
    } else if (type === "DECREASE") {
      newQty = Math.max(0, previousQty - quantity)
    } else if (type === "CORRECTION") {
      newQty = quantity
    } else {
      return NextResponse.json({ error: "Invalid adjustment type" }, { status: 400 })
    }

    // Build product update payload
    const productUpdateData: Record<string, unknown> = { quantity: newQty }
    if (batchNumber !== undefined) {
      productUpdateData.batch_number = batchNumber || null
    }
    if (expiryDate !== undefined) {
      productUpdateData.expiry_date = expiryDate || null
    }

    // Update product quantity (and optionally batch/expiry)
    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from("pharmacy_products")
      .update(productUpdateData)
      .eq("id", productId)
      .eq("tenant_id", tenantId)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Create stock adjustment record
    const { error: adjustmentError } = await supabaseAdmin
      .from("pharmacy_stock_adjustments")
      .insert({
        tenant_id: tenantId,
        product_id: productId,
        quantity,
        type,
        reason: reason || `Stock ${type.toLowerCase()}`,
        previous_qty: previousQty,
        new_qty: newQty,
        created_by: session.user.id,
      })

    if (adjustmentError) return NextResponse.json({ error: adjustmentError.message }, { status: 500 })

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "STOCK_ADJUSTMENT",
      entity: "PRODUCT",
      entity_id: productId,
      details: `Stock ${type}: ${product.name} - Previous: ${previousQty}, Added: ${quantity}, New: ${newQty}`,
    })

    // Crossing below reorder → mobile push to pharmacy staff
    if (reorderLevel > 0 && previousQty > reorderLevel && newQty <= reorderLevel) {
      const { notifyPharmacyStock } = await import("@synapse/auth/mobile-push")
      notifyPharmacyStock({
        tenantId,
        productName: product.name,
        reason: "reorder",
        detail: `${product.name} is at ${newQty} (reorder ${reorderLevel}).`,
      })
    }

    return NextResponse.json({
      product: updatedProduct,
      adjustment: {
        previousQty,
        quantity,
        newQty,
        type,
      },
    })
  } catch (error) {
    console.error("Stock update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
