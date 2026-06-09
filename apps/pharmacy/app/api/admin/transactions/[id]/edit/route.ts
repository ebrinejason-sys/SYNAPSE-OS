import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

interface EditItemRequest {
  id: string
  quantity: number
  unitPrice: number
}

interface EditTransactionRequest {
  items: EditItemRequest[]
  paymentMethod: string
  reason: string
  discount?: number
}

// Edit a transaction and send priority notifications to CEO/ADMIN
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 })
    }

    const { id } = await params
    const body: EditTransactionRequest = await request.json()

    // Validate reason is provided and not empty
    if (!body.reason || body.reason.trim().length < 10) {
      return NextResponse.json(
        { error: "A reason for editing is required (minimum 10 characters)" },
        { status: 400 }
      )
    }

    // Get existing transaction with items (RLS scoped read)
    const supabase = await createClient()
    const { data: existingTransaction, error: fetchError } = await supabase
      .from("pharmacy_transactions")
      .select(`
        *,
        cashier:profiles!pharmacy_transactions_cashier_id_fkey ( full_name ),
        items:pharmacy_transaction_items (
          *,
          product:pharmacy_products ( id, name, sku, cost_price )
        )
      `)
      .eq("id", id)
      .single()

    if (fetchError || !existingTransaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Snapshot of previous data as JSONB object (NOT stringified)
    const previousData = existingTransaction as unknown as Record<string, unknown>

    // Tax defaulted to 0 (no settings table in schema)
    const taxRate = 0

    // Process stock adjustments for quantity changes
    for (const editItem of body.items) {
      const existingItem = (existingTransaction.items ?? []).find(
        (item: { id: string }) => item.id === editItem.id
      )

      if (!existingItem) continue

      const quantityDiff = editItem.quantity - (existingItem as { quantity: number }).quantity

      if (quantityDiff !== 0) {
        const { data: product } = await supabaseAdmin
          .from("pharmacy_products")
          .select("quantity")
          .eq("id", (existingItem as { product_id: string }).product_id)
          .eq("tenant_id", tenantId)
          .single()

        if (product) {
          const newQty = product.quantity - quantityDiff
          await supabaseAdmin
            .from("pharmacy_products")
            .update({
              quantity: newQty,
              updated_at: new Date().toISOString(),
            })
            .eq("id", (existingItem as { product_id: string }).product_id)
            .eq("tenant_id", tenantId)

          await supabaseAdmin.from("pharmacy_stock_adjustments").insert({
            tenant_id: tenantId,
            product_id: (existingItem as { product_id: string }).product_id,
            quantity: -quantityDiff,
            type: quantityDiff > 0 ? "DECREASE" : "INCREASE",
            reason: `Transaction Edit - ${existingTransaction.transaction_no}: ${body.reason}`,
            previous_qty: product.quantity,
            new_qty: newQty,
            created_by: session.user.id,
          })
        }
      }
    }

    // Calculate new totals
    let newTotalAmount = 0
    const updatedItems: Array<{
      id: string
      quantity: number
      unit_price: number
      total_price: number
    }> = body.items.map((editItem) => {
      const totalPrice = editItem.unitPrice * editItem.quantity
      newTotalAmount += totalPrice
      return {
        id: editItem.id,
        quantity: editItem.quantity,
        unit_price: editItem.unitPrice,
        total_price: totalPrice,
      }
    })

    const discount =
      body.discount !== undefined
        ? body.discount
        : (existingTransaction as { discount: number }).discount ?? 0
    const newTax = (newTotalAmount - discount) * (taxRate / 100)
    const newNetAmount = newTotalAmount - discount + newTax

    // Update transaction items
    for (const item of updatedItems) {
      await supabaseAdmin
        .from("pharmacy_transaction_items")
        .update({
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })
        .eq("id", item.id)
        .eq("tenant_id", tenantId)
    }

    // Update transaction
    const { data: updatedTransaction, error: updateError } = await supabaseAdmin
      .from("pharmacy_transactions")
      .update({
        total_amount: newTotalAmount,
        discount,
        tax: newTax,
        net_amount: newNetAmount,
        payment_method: body.paymentMethod,
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(`
        *,
        cashier:profiles!pharmacy_transactions_cashier_id_fkey ( full_name ),
        items:pharmacy_transaction_items (
          *,
          product:pharmacy_products ( id, name, sku, cost_price )
        )
      `)
      .single()

    if (updateError || !updatedTransaction) {
      console.error("Update transaction error:", updateError)
      return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 })
    }

    // Snapshot of new data as JSONB object (NOT stringified)
    const newData = updatedTransaction as unknown as Record<string, unknown>

    // Create pharmacy_transaction_edits record — previous_data/new_data as JSONB objects
    await supabaseAdmin.from("pharmacy_transaction_edits").insert({
      tenant_id: tenantId,
      transaction_id: id,
      edited_by: session.user.id,
      reason: body.reason.trim(),
      previous_data: previousData,
      new_data: newData,
    })

    // Create audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "EDIT_TRANSACTION",
      entity: "TRANSACTION",
      entity_id: id,
      details: `Edited transaction ${existingTransaction.transaction_no}. Reason: ${body.reason}`,
    })

    // Send priority notifications to ALL CEO and ADMIN users in this tenant
    const { data: adminUsers } = await supabaseAdmin
      .from("pharmacy_user_settings")
      .select("profile_id")
      .eq("tenant_id", tenantId)
      .in("pharmacy_role", ["pharmacy_ceo", "pharmacy_admin"])
      .eq("is_active", true)

    if (adminUsers && adminUsers.length > 0) {
      const editorName =
        session.profile.full_name ??
        session.profile.first_name ??
        session.user.email ??
        "A staff member"

      await supabaseAdmin.from("pharmacy_notifications").insert(
        adminUsers.map((u: { profile_id: string }) => ({
          tenant_id: tenantId,
          profile_id: u.profile_id,
          type: "TRANSACTION_EDIT",
          title: "Transaction Edited",
          message: `${editorName} edited transaction ${existingTransaction.transaction_no}. Reason: ${body.reason}`,
          related_id: id,
          is_read: false,
        }))
      )
    }

    return NextResponse.json({
      success: true,
      transaction: updatedTransaction,
      message: "Transaction updated successfully",
    })
  } catch (error) {
    console.error("Edit transaction error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Get transaction edit history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const supabase = await createClient()
    const { data: edits, error } = await supabase
      .from("pharmacy_transaction_edits")
      .select("*")
      .eq("transaction_id", id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Get transaction edits error:", error)
      return NextResponse.json({ error: "Failed to fetch edit history" }, { status: 500 })
    }

    // Resolve editor profiles in a single batch query
    const editorIds = [
      ...new Set((edits ?? []).map((e: { edited_by: string }) => e.edited_by)),
    ]

    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {}

    if (editorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", editorIds)

      // Fetch emails from auth.users — available via admin client
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()

      const emailMap: Record<string, string> = {}
      for (const u of authUsers?.users ?? []) {
        emailMap[u.id] = u.email ?? ""
      }

      for (const p of profiles ?? []) {
        profileMap[p.id] = {
          full_name: p.full_name ?? null,
          email: emailMap[p.id] ?? null,
        }
      }
    }

    const editsWithEditor = (edits ?? []).map(
      (e: { edited_by: string; [key: string]: unknown }) => ({
        ...e,
        editor: profileMap[e.edited_by] ?? { full_name: null, email: null },
      })
    )

    return NextResponse.json({ edits: editsWithEditor })
  } catch (error) {
    console.error("Get transaction edits error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
