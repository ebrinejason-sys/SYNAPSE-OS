import { NextRequest, NextResponse } from "next/server"
import { isPharmacyAdmin } from "@/lib/auth"
import { requirePharmacyAdmin } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

/**
 * DELETE /api/admin/transactions/[id]
 * Delete a specific transaction (Admin only)
 * Includes reversal of stock adjustments
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    if (!isPharmacyAdmin(session)) {
      return NextResponse.json(
        { error: "Only admins can delete transactions" },
        { status: 403 }
      )
    }

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 })
    }

    // Fetch the transaction with all its items
    const { data: transaction, error: fetchError } = await (supabaseAdmin as any)
      .from("pharmacy_transactions")
      .select("*, items:pharmacy_transaction_items(*)")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .single()

    if (fetchError || !transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Find stock adjustments for this transaction
    const { data: stockAdjustments } = await supabaseAdmin
      .from("pharmacy_stock_adjustments")
      .select("*")
      .eq("tenant_id", tenantId)
      .like("reason", `Sale - Transaction ${transaction.transaction_no}%`)

    // Delete the stock adjustments
    if (stockAdjustments && stockAdjustments.length > 0) {
      await supabaseAdmin
        .from("pharmacy_stock_adjustments")
        .delete()
        .eq("tenant_id", tenantId)
        .like("reason", `Sale - Transaction ${transaction.transaction_no}%`)
    }

    // Restore product quantities based on the deleted stock adjustments
    for (const adjustment of stockAdjustments ?? []) {
      const { data: product } = await supabaseAdmin
        .from("pharmacy_products")
        .select("quantity")
        .eq("id", adjustment.product_id)
        .eq("tenant_id", tenantId)
        .single()

      if (product) {
        await supabaseAdmin
          .from("pharmacy_products")
          .update({
            quantity: product.quantity + Math.abs(adjustment.quantity),
            updated_at: new Date().toISOString(),
          })
          .eq("id", adjustment.product_id)
          .eq("tenant_id", tenantId)
      }
    }

    // Delete transaction items first (foreign key constraint)
    await supabaseAdmin
      .from("pharmacy_transaction_items")
      .delete()
      .eq("transaction_id", id)
      .eq("tenant_id", tenantId)

    // Delete the transaction itself
    await supabaseAdmin
      .from("pharmacy_transactions")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)

    // Create audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "DELETE_TRANSACTION",
      entity: "TRANSACTION",
      entity_id: id,
      details: `Deleted transaction ${transaction.transaction_no}. Total amount: ${transaction.net_amount}. Items: ${(transaction.items ?? []).length}. Stock levels have been restored.`,
    })

    return NextResponse.json({
      success: true,
      message: `Transaction ${transaction.transaction_no} has been deleted successfully. Stock levels have been restored.`,
      deletedTransaction: {
        id: transaction.id,
        transactionNo: transaction.transaction_no,
        netAmount: transaction.net_amount,
        itemsCount: (transaction.items ?? []).length,
      },
    })
  } catch (error) {
    console.error("Delete transaction error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const rawName = typeof body?.clientName === "string" ? body.clientName : ""
    const clientName = rawName.trim() ? rawName.trim() : null

    const { data: updatedTransaction, error: updateError } = await supabaseAdmin
      .from("pharmacy_transactions")
      .update({
        client_name: clientName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(`
        *,
        cashier:profiles!pharmacy_transactions_cashier_id_fkey ( full_name ),
        items:pharmacy_transaction_items (
          *,
          product:pharmacy_products ( id, name, sku, cost_price ),
          batch:pharmacy_product_batches ( id, batch_number, expiry_date )
        )
      `)
      .single()

    if (updateError || !updatedTransaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "UPDATE_TRANSACTION_CLIENT",
      entity: "TRANSACTION",
      entity_id: id,
      details: `Updated client name for transaction ${updatedTransaction.transaction_no}`,
    })

    return NextResponse.json({ success: true, transaction: updatedTransaction })
  } catch (error) {
    console.error("Patch transaction error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
