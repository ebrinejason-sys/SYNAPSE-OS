import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

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
  reason: string | null
  items?: Array<{ id: string; quantity: number }> | null
}) {
  const { data: sale, error } = await db()
    .from("pharmacy_pos_sales")
    .select(
      `
      *,
      items:pharmacy_pos_sale_items (
        id, product_id, batch_id, quantity, unit_price,
        product:pharmacy_products ( id, name, quantity )
      )
    `,
    )
    .eq("tenant_id", params.tenantId)
    .eq("id", params.saleId)
    .maybeSingle()

  if (error || !sale) return { notFound: true as const }
  if (sale.status === "voided") {
    return { already: true as const }
  }
  if (sale.status !== "completed") {
    return { badStatus: sale.status as string }
  }

  const saleItems = (sale.items ?? []) as Array<{
    id: string
    product_id: string
    batch_id: string | null
    quantity: number
    unit_price: number
    product: { id: string; name: string; quantity: number } | null
  }>

  const itemsToRefund =
    params.items && params.items.length > 0
      ? params.items
      : saleItems.map((i) => ({ id: i.id, quantity: i.quantity }))

  let refundAmount = 0

  for (const refundItem of itemsToRefund) {
    const original = saleItems.find((i) => i.id === refundItem.id)
    if (!original) continue
    const refundQty = Math.min(refundItem.quantity, original.quantity)
    refundAmount += Number(original.unit_price) * refundQty

    if (original.batch_id) {
      const { data: batch } = await db()
        .from("pharmacy_product_batches")
        .select("quantity")
        .eq("id", original.batch_id)
        .eq("tenant_id", params.tenantId)
        .maybeSingle()
      if (batch) {
        await db()
          .from("pharmacy_product_batches")
          .update({
            quantity: Number(batch.quantity ?? 0) + refundQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", original.batch_id)
          .eq("tenant_id", params.tenantId)
      }
    }

    if (original.product_id) {
      const { data: product } = await db()
        .from("pharmacy_products")
        .select("quantity")
        .eq("id", original.product_id)
        .eq("tenant_id", params.tenantId)
        .maybeSingle()
      if (product) {
        const previousQty = Number(product.quantity ?? 0)
        const newQty = previousQty + refundQty
        await db()
          .from("pharmacy_products")
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq("id", original.product_id)
          .eq("tenant_id", params.tenantId)

        await db().from("pharmacy_stock_adjustments").insert({
          tenant_id: params.tenantId,
          product_id: original.product_id,
          quantity: refundQty,
          type: "INCREASE",
          reason: `Refund from POS sale ${sale.receipt_number}: ${params.reason ?? "No reason provided"}`,
          previous_qty: previousQty,
          new_qty: newQty,
          created_by: params.userId,
        })
      }
    }
  }

  const { data: updated, error: updateError } = await db()
    .from("pharmacy_pos_sales")
    .update({
      status: "voided",
      voided_reason: params.reason ?? "Refund",
      voided_by: params.userId,
      voided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.saleId)
    .eq("tenant_id", params.tenantId)
    .select("*")
    .single()

  if (updateError || !updated) {
    return { updateFailed: updateError?.message ?? "update failed" }
  }

  await db().from("pharmacy_audit_logs").insert({
    tenant_id: params.tenantId,
    profile_id: params.userId,
    action: "REFUND_POS_SALE",
    entity: "POS_SALE",
    entity_id: params.saleId,
    details: `Voided POS sale ${sale.receipt_number}. Amount: ${refundAmount}. Reason: ${params.reason ?? "Not specified"}`,
  })

  return { ok: true as const, refundAmount, sale: updated }
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

    const { transactionId, reason, items } = await request.json()

    if (!transactionId) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 })
    }

    const posResult = await refundPosSale({
      tenantId,
      userId: session.user.id,
      saleId: transactionId,
      reason: reason ?? null,
      items: items ?? null,
    })

    if ("already" in posResult && posResult.already) {
      return NextResponse.json({ error: "Transaction already refunded" }, { status: 400 })
    }
    if ("badStatus" in posResult) {
      return NextResponse.json(
        { error: `Cannot refund sale in status ${posResult.badStatus}` },
        { status: 400 },
      )
    }
    if ("updateFailed" in posResult) {
      return NextResponse.json({ error: "Failed to void POS sale" }, { status: 500 })
    }
    if ("ok" in posResult && posResult.ok) {
      return NextResponse.json({
        success: true,
        refundAmount: posResult.refundAmount,
        transaction: posResult.sale,
        source: "pos",
      })
    }

    // Legacy / order path
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
      .eq("id", transactionId)
      .single()

    if (fetchError || !transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (transaction.status === "REFUNDED") {
      return NextResponse.json({ error: "Transaction already refunded" }, { status: 400 })
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
          reason: `Refund from transaction ${transaction.transaction_no}: ${reason ?? "No reason provided"}`,
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
        notes: `${existingNotes}\n[REFUNDED] ${new Date().toISOString()}: ${reason ?? "No reason provided"} - Amount: ${refundAmount}`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId)
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
      entity_id: transactionId,
      details: `Refunded transaction ${transaction.transaction_no}. Amount: ${refundAmount}. Reason: ${reason ?? "Not specified"}`,
    })

    return NextResponse.json({
      success: true,
      refundAmount,
      transaction: updatedTransaction,
      source: "order",
    })
  } catch (error) {
    console.error("Process refund error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
