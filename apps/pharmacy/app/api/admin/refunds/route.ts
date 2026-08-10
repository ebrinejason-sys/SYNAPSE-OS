import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { reversePharmacySale } from "@synapse/db/inventory-rpc"

const db = () => supabaseAdmin as any

// GET - List refunds (voided POS sales + REFUNDED order txs)
export async function GET(_request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("pos.refund")
    if (!auth.ok) return auth.response
    const { tenantId } = auth

    const [{ data: posVoids }, { data: orderRefunds, error }] = await Promise.all([
      db()
        .from("pharmacy_pos_sales")
        .select(
          `
          id, receipt_number, total_amount, payment_method, cashier_id, status,
          voided_reason, voided_at, updated_at, created_at,
          items:pharmacy_pos_sale_items (
            id, quantity, unit_price, product:pharmacy_products ( name, sku )
          )
        `,
        )
        .eq("tenant_id", tenantId)
        .eq("status", "voided")
        .order("updated_at", { ascending: false }),
      db()
        .from("pharmacy_transactions")
        .select(
          `
          *,
          cashier:profiles!pharmacy_transactions_cashier_id_fkey ( full_name ),
          items:pharmacy_transaction_items (
            *,
            product:pharmacy_products ( name, sku )
          )
        `,
        )
        .eq("tenant_id", tenantId)
        .eq("status", "REFUNDED")
        .order("updated_at", { ascending: false }),
    ])

    if (error) {
      console.error("Get refunds error:", error)
      return NextResponse.json({ error: "Failed to fetch refunds" }, { status: 500 })
    }

    const mappedPos = (posVoids ?? []).map((s: any) => ({
      id: s.id,
      transaction_no: s.receipt_number,
      net_amount: s.total_amount,
      payment_method: s.payment_method,
      status: "REFUNDED",
      notes: s.voided_reason,
      updated_at: s.voided_at ?? s.updated_at,
      created_at: s.created_at,
      source: "pos",
      items: s.items ?? [],
    }))

    return NextResponse.json([...mappedPos, ...(orderRefunds ?? [])])
  } catch (error) {
    console.error("Get refunds error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function refundPosSale(params: {
  tenantId: string
  userId: string
  saleId: string
  reason: string
  restoreAs?: "active" | "quarantined"
}) {
  const { data, error } = await reversePharmacySale(db(), {
    tenantId: params.tenantId,
    saleId: params.saleId,
    actorId: params.userId,
    reason: params.reason,
    restoreAs: params.restoreAs ?? "quarantined",
  })

  if (error) {
    if (error.code === "ALREADY_REFUNDED") return { already: true as const, error }
    if (error.code === "PRODUCT_NOT_FOUND") return { notFound: true as const, error }
    if (error.code === "SALE_NOT_REFUNDABLE") {
      return { badStatus: true as const, error }
    }
    return { rpcFailed: true as const, error }
  }

  return {
    ok: true as const,
    refundAmount: Number((data as any)?.refund_amount ?? 0),
    sale: data,
  }
}

// POST - Process a refund (POS void preferred; order tx fallback)
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission("pos.refund")
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 })
    }

    const body = await request.json()
    const { transactionId, saleId, reason, restoreAs, items } = body as {
      transactionId?: string
      saleId?: string
      reason?: string
      restoreAs?: "active" | "quarantined"
      items?: Array<{ id: string; quantity: number }>
    }

    const id = transactionId ?? saleId
    if (!id) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 })
    }

    const refundReason = typeof reason === "string" && reason.trim() ? reason.trim() : ""
    if (!refundReason) {
      return NextResponse.json({ error: "Refund reason is required" }, { status: 400 })
    }

    const posResult = await refundPosSale({
      tenantId,
      userId: session.user.id,
      saleId: id,
      reason: refundReason,
      restoreAs: restoreAs === "active" ? "active" : "quarantined",
    })

    if ("already" in posResult && posResult.already) {
      return NextResponse.json(
        {
          error: posResult.error?.humanMessage ?? "Transaction already refunded",
          code: "ALREADY_REFUNDED",
        },
        { status: 409 },
      )
    }
    if ("badStatus" in posResult && posResult.badStatus) {
      return NextResponse.json(
        {
          error: posResult.error?.humanMessage ?? "Sale is not refundable",
          code: "SALE_NOT_REFUNDABLE",
        },
        { status: 400 },
      )
    }
    if ("rpcFailed" in posResult && posResult.rpcFailed) {
      return NextResponse.json(
        {
          error: posResult.error?.humanMessage ?? "Failed to void POS sale",
          code: posResult.error?.code,
        },
        { status: 400 },
      )
    }
    if ("ok" in posResult && posResult.ok) {
      return NextResponse.json({
        success: true,
        refundAmount: posResult.refundAmount,
        transaction: posResult.sale,
        source: "pos",
      })
    }
    // notFound → try legacy pharmacy_transactions path below

    // Legacy / order path — restore product qty only; never invent batches
    const { data: transaction, error: fetchError } = await db()
      .from("pharmacy_transactions")
      .select(
        `
        *,
        items:pharmacy_transaction_items (
          *,
          product:pharmacy_products ( id, name, quantity )
        )
      `,
      )
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .single()

    if (fetchError || !transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (transaction.status === "REFUNDED") {
      return NextResponse.json(
        { error: "Transaction already refunded", code: "ALREADY_REFUNDED" },
        { status: 409 },
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
        (i) => i.id === refundItem.id,
      )
      if (!originalItem) continue

      const refundQty = Math.min(refundItem.quantity, originalItem.quantity)
      refundAmount += originalItem.unit_price * refundQty

      if (!originalItem.product_id) continue

      // Legacy path: bump denormalised product qty only — do NOT fabricate batch rows.
      // Restored units remain unbatched / non-sellable until received with genuine batch data.
      const { data: currentProduct } = await supabaseAdmin
        .from("pharmacy_products")
        .select("quantity")
        .eq("id", originalItem.product_id)
        .eq("tenant_id", tenantId)
        .single()

      if (currentProduct) {
        const previousQty = currentProduct.quantity
        const newQty = previousQty + refundQty

        await supabaseAdmin
          .from("pharmacy_products")
          .update({
            quantity: newQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", originalItem.product_id)
          .eq("tenant_id", tenantId)

        await supabaseAdmin.from("pharmacy_stock_adjustments").insert({
          tenant_id: tenantId,
          product_id: originalItem.product_id,
          quantity: refundQty,
          type: "INCREASE",
          reason: `Refund from transaction ${transaction.transaction_no}: ${refundReason}`,
          previous_qty: previousQty,
          new_qty: newQty,
          created_by: session.user.id,
        })
      }
    }

    const existingNotes = (transaction as { notes: string | null }).notes ?? ""
    const { data: updatedTransaction, error: updateError } = await supabaseAdmin
      .from("pharmacy_transactions")
      .update({
        status: "REFUNDED",
        notes: `${existingNotes}\n[REFUNDED] ${new Date().toISOString()}: ${refundReason} - Amount: ${refundAmount}`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select(
        `
        *,
        cashier:profiles!pharmacy_transactions_cashier_id_fkey ( full_name ),
        items:pharmacy_transaction_items (*)
      `,
      )
      .single()

    if (updateError || !updatedTransaction) {
      console.error("Update transaction status error:", updateError)
      return NextResponse.json({ error: "Failed to update transaction status" }, { status: 500 })
    }

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "REFUND_TRANSACTION",
      entity: "TRANSACTION",
      entity_id: id,
      details: `Refunded transaction ${transaction.transaction_no}. Amount: ${refundAmount}. Reason: ${refundReason}`,
    })

    return NextResponse.json({
      success: true,
      refundAmount,
      transaction: updatedTransaction,
      source: "order",
      warning:
        "Legacy order refund restored product quantity only. Units are not sellable until received onto a genuine batch.",
    })
  } catch (error) {
    console.error("Process refund error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
