import { NextRequest, NextResponse } from "next/server"
import { isPharmacyAdmin } from "@/lib/auth"
import { requirePharmacyAdmin } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

/**
 * DELETE /api/admin/transactions/[id]
 * Hard deletes are forbidden. Stock-moving records must be voided/refunded.
 */
export async function DELETE(
  _request: NextRequest,
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

    const { data: posSale } = await (supabaseAdmin as any)
      .from("pharmacy_pos_sales")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle()
    if (posSale) {
      return NextResponse.json(
        {
          error:
            "POS sales cannot be deleted here. Use void/refund so stock and cash stay reconciled.",
          code: "POS_APPEND_ONLY",
        },
        { status: 409 },
      )
    }

    return NextResponse.json(
      {
        error:
          "Transactions that moved stock cannot be deleted. Use refund/void so batch inventory stays authoritative.",
        code: "POS_APPEND_ONLY",
      },
      { status: 409 },
    )
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
