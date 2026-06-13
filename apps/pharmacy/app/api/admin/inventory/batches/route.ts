import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

// GET batches for a product (ordered by expiry date for FIFO)
export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!session.profile.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get("productId")

    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: batches, error } = await supabase
      .from("pharmacy_product_batches")
      .select("*")
      .eq("product_id", productId)
      .eq("is_active", true)
      .order("expiry_date", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(batches ?? [])
  } catch (error) {
    console.error("Get batches error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a new batch
export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!session.profile.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 })
    const tenantId = session.profile.tenant_id

    const supabase = await createClient()
    const data: Record<string, unknown> = await request.json()

    if (!data.productId || !data.batchNumber || !data.quantity || !data.expiryDate) {
      return NextResponse.json(
        { error: "Product ID, batch number, quantity, and expiry date are required" },
        { status: 400 }
      )
    }

    // Check if batch with same number already exists for this product (RLS-scoped)
    const { data: existing } = await supabase
      .from("pharmacy_product_batches")
      .select("id")
      .eq("product_id", data.productId as string)
      .eq("batch_number", data.batchNumber as string)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "A batch with this number already exists for this product" },
        { status: 400 }
      )
    }

    // Get product to use its cost price if not provided (RLS-scoped)
    const { data: product } = await supabase
      .from("pharmacy_products")
      .select("id, cost_price, quantity")
      .eq("id", data.productId as string)
      .maybeSingle()

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    // Create the batch
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("pharmacy_product_batches")
      .insert({
        tenant_id: tenantId,
        product_id: data.productId as string,
        batch_number: data.batchNumber as string,
        quantity: data.quantity as number,
        initial_quantity: data.quantity as number,
        expiry_date: data.expiryDate as string,
        cost_price: (data.costPrice as number) || product.cost_price,
        notes: (data.notes as string) || null,
      })
      .select()
      .single()

    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 })

    // Update product total quantity
    const newProductQty = (product.quantity ?? 0) + (data.quantity as number)
    const { error: updateError } = await supabaseAdmin
      .from("pharmacy_products")
      .update({ quantity: newProductQty })
      .eq("id", data.productId as string)
      .eq("tenant_id", tenantId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "CREATE_BATCH",
      entity: "PRODUCT_BATCH",
      entity_id: batch.id,
      details: `Created batch "${data.batchNumber}" with ${data.quantity} units, expires ${new Date(data.expiryDate as string).toLocaleDateString()}`,
    })

    return NextResponse.json(batch)
  } catch (error) {
    console.error("Create batch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH - Update a batch
export async function PATCH(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!session.profile.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 })
    const tenantId = session.profile.tenant_id

    const supabase = await createClient()
    const data: Record<string, unknown> = await request.json()

    if (!data.id) {
      return NextResponse.json({ error: "Batch ID is required" }, { status: 400 })
    }

    // Fetch existing batch (RLS-scoped)
    const { data: existingBatch } = await supabase
      .from("pharmacy_product_batches")
      .select("id, product_id, batch_number, quantity")
      .eq("id", data.id as string)
      .maybeSingle()

    if (!existingBatch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }

    // Calculate quantity difference for product update
    const quantityDiff =
      data.quantity !== undefined
        ? (data.quantity as number) - existingBatch.quantity
        : 0

    // Build update fields
    const updateFields: Record<string, unknown> = {}
    if (data.quantity !== undefined) updateFields.quantity = data.quantity
    if (data.expiryDate !== undefined) updateFields.expiry_date = data.expiryDate || null
    if (data.costPrice !== undefined) updateFields.cost_price = data.costPrice
    if (data.notes !== undefined) updateFields.notes = data.notes
    if (data.isActive !== undefined) updateFields.is_active = data.isActive

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("pharmacy_product_batches")
      .update(updateFields)
      .eq("id", data.id as string)
      .eq("tenant_id", tenantId)
      .select()
      .single()

    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 })

    // Update product total quantity if quantity changed
    if (quantityDiff !== 0) {
      // Fetch current product quantity
      const { data: product } = await supabase
        .from("pharmacy_products")
        .select("quantity")
        .eq("id", existingBatch.product_id)
        .maybeSingle()

      const newProductQty = (product?.quantity ?? 0) + quantityDiff
      const { error: updateError } = await supabaseAdmin
        .from("pharmacy_products")
        .update({ quantity: newProductQty })
        .eq("id", existingBatch.product_id)
        .eq("tenant_id", tenantId)
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "UPDATE_BATCH",
      entity: "PRODUCT_BATCH",
      entity_id: batch.id,
      details: `Updated batch "${batch.batch_number}"`,
    })

    return NextResponse.json(batch)
  } catch (error) {
    console.error("Update batch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Deactivate a batch (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getPharmacySession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!session.profile.tenant_id) return NextResponse.json({ error: "No tenant" }, { status: 403 })
    const tenantId = session.profile.tenant_id

    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Batch ID is required" }, { status: 400 })
    }

    // Fetch batch to get product_id and remaining quantity (RLS-scoped)
    const { data: existingBatch } = await supabase
      .from("pharmacy_product_batches")
      .select("id, product_id, batch_number, quantity")
      .eq("id", id)
      .maybeSingle()

    if (!existingBatch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }

    // Soft-delete the batch
    const { error: batchError } = await supabaseAdmin
      .from("pharmacy_product_batches")
      .update({ is_active: false })
      .eq("id", id)
      .eq("tenant_id", tenantId)

    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 })

    // Subtract remaining quantity from product total
    if (existingBatch.quantity > 0) {
      const { data: product } = await supabase
        .from("pharmacy_products")
        .select("quantity")
        .eq("id", existingBatch.product_id)
        .maybeSingle()

      const newProductQty = Math.max(0, (product?.quantity ?? 0) - existingBatch.quantity)
      const { error: updateError } = await supabaseAdmin
        .from("pharmacy_products")
        .update({ quantity: newProductQty })
        .eq("id", existingBatch.product_id)
        .eq("tenant_id", tenantId)
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "DELETE_BATCH",
      entity: "PRODUCT_BATCH",
      entity_id: id,
      details: `Deactivated batch "${existingBatch.batch_number}"`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete batch error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
