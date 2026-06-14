import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin, hasPermission } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

// GET - List refunds
export async function GET(request: NextRequest) {
  try {
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canManageTransactions =
      isPharmacyAdmin(session) || hasPermission(session, "MANAGE_TRANSACTIONS")

    if (!canManageTransactions) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { data: refunds, error } = await (supabaseAdmin as any)
      .from("pharmacy_transactions")
      .select(`
        *,
        cashier:profiles!pharmacy_transactions_cashier_id_fkey ( full_name ),
        items:pharmacy_transaction_items (
          *,
          product:pharmacy_products ( name, sku )
        )
      `)
      .eq("tenant_id", session.profile.tenant_id!)
      .eq("status", "REFUNDED")
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Get refunds error:", error)
      return NextResponse.json({ error: "Failed to fetch refunds" }, { status: 500 })
    }

    return NextResponse.json(refunds ?? [])
  } catch (error) {
    console.error("Get refunds error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Process a refund
export async function POST(request: NextRequest) {
  try {
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canManageTransactions =
      isPharmacyAdmin(session) || hasPermission(session, "MANAGE_TRANSACTIONS")

    if (!canManageTransactions) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const tenantId = session.profile.tenant_id
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 })
    }

    const { transactionId, reason, items } = await request.json()

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      )
    }

    // Get the original transaction (scoped to tenant)
    const { data: transaction, error: fetchError } = await (supabaseAdmin as any)
      .from("pharmacy_transactions")
      .select(`
        *,
        items:pharmacy_transaction_items (
          *,
          product:pharmacy_products ( id, name, quantity )
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("id", transactionId)
      .single()

    if (fetchError || !transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (transaction.status === "REFUNDED") {
      return NextResponse.json(
        { error: "Transaction already refunded" },
        { status: 400 }
      )
    }

    interface RefundItemInput {
      id: string
      quantity: number
    }

    interface TransactionItemRow {
      id: string
      product_id: string
      unit_price: number
      quantity: number
      product: { id: string; name: string; quantity: number } | null
    }

    // Use provided items for partial refund, or all items for full refund
    const itemsToRefund: RefundItemInput[] =
      items && items.length > 0
        ? (items as RefundItemInput[])
        : (transaction.items as TransactionItemRow[]).map((i) => ({
            id: i.id,
            quantity: i.quantity,
          }))

    let refundAmount = 0

    for (const refundItem of itemsToRefund) {
      const originalItem = (transaction.items as TransactionItemRow[]).find(
        (i) => i.id === refundItem.id
      )
      if (!originalItem) continue

      const refundQty = Math.min(refundItem.quantity, originalItem.quantity)
      refundAmount += originalItem.unit_price * refundQty

      if (!originalItem.product_id) continue

      // Fetch current product quantity for accurate adjustment records
      const { data: currentProduct } = await supabaseAdmin
        .from("pharmacy_products")
        .select("quantity")
        .eq("id", originalItem.product_id)
        .eq("tenant_id", tenantId)
        .single()

      if (currentProduct) {
        const previousQty = currentProduct.quantity
        const newQty = previousQty + refundQty

        // Restore stock
        await supabaseAdmin
          .from("pharmacy_products")
          .update({
            quantity: newQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", originalItem.product_id)
          .eq("tenant_id", tenantId)

        // Create stock adjustment record
        await supabaseAdmin.from("pharmacy_stock_adjustments").insert({
          tenant_id: tenantId,
          product_id: originalItem.product_id,
          quantity: refundQty,
          type: "INCREASE",
          reason: `Refund from transaction ${transaction.transaction_no}: ${reason ?? "No reason provided"}`,
          previous_qty: previousQty,
          new_qty: newQty,
          created_by: session.user.id,
        })
      }
    }

    // Update transaction status to REFUNDED
    const existingNotes = (transaction as { notes: string | null }).notes ?? ""
    const { data: updatedTransaction, error: updateError } = await supabaseAdmin
      .from("pharmacy_transactions")
      .update({
        status: "REFUNDED",
        notes: `${existingNotes}\n[REFUNDED] ${new Date().toISOString()}: ${reason ?? "No reason provided"} - Amount: ${refundAmount}`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
      .eq("tenant_id", tenantId)
      .select(`
        *,
        cashier:profiles!pharmacy_transactions_cashier_id_fkey ( full_name ),
        items:pharmacy_transaction_items (*)
      `)
      .single()

    if (updateError || !updatedTransaction) {
      console.error("Update transaction status error:", updateError)
      return NextResponse.json({ error: "Failed to update transaction status" }, { status: 500 })
    }

    // Create audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "REFUND_TRANSACTION",
      entity: "TRANSACTION",
      entity_id: transactionId,
      details: `Refunded transaction ${transaction.transaction_no}. Amount: ${refundAmount}. Reason: ${reason ?? "Not specified"}`,
    })

    return NextResponse.json({
      success: true,
      refundAmount,
      transaction: updatedTransaction,
    })
  } catch (error) {
    console.error("Process refund error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
