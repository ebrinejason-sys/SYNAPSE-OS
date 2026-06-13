import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!session.profile.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 })
    const tenantId = session.profile.tenant_id

    const supabase = await createClient()

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

    // Fetch product (RLS-scoped to tenant)
    const { data: product } = await supabase
      .from("pharmacy_products")
      .select("id, name, quantity, batch_number, expiry_date")
      .eq("id", productId)
      .maybeSingle()

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const previousQty: number = product.quantity ?? 0
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
