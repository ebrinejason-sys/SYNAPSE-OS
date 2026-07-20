import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyAdmin } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"

interface TransactionItemRow {
  unit_price: number
  cost_price: number | null
  quantity: number
  product?: { cost_price: number | null } | null
}

// Calculate profit for a set of transaction items
function calculateProfit(items: TransactionItemRow[]): number {
  return items.reduce((total, item) => {
    const costAtSale = item.cost_price ?? item.product?.cost_price ?? 0
    const profit = (item.unit_price - costAtSale) * Math.abs(item.quantity)
    return total + profit
  }, 0)
}

// Reset all sales/transactions (Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 })
    }

    // Delete transaction items first (foreign key constraint)
    const { error: itemsError } = await supabaseAdmin
      .from("pharmacy_transaction_items")
      .delete()
      .eq("tenant_id", tenantId)

    if (itemsError) {
      console.error("Delete transaction items error:", itemsError)
      return NextResponse.json({ error: "Failed to delete transaction items" }, { status: 500 })
    }

    // Delete all transactions for this tenant
    const { data: deletedRows, error: txError } = await supabaseAdmin
      .from("pharmacy_transactions")
      .delete()
      .eq("tenant_id", tenantId)
      .select("id")

    if (txError) {
      console.error("Delete transactions error:", txError)
      return NextResponse.json({ error: "Failed to delete transactions" }, { status: 500 })
    }

    const deletedCount = deletedRows?.length ?? 0

    // Create audit log
    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "RESET_SALES",
      entity: "TRANSACTION",
      details: `Reset all sales. Deleted ${deletedCount} transactions.`,
    })

    return NextResponse.json({
      success: true,
      message: `Successfully reset sales. Deleted ${deletedCount} transactions.`,
      deletedCount,
    })
  } catch (error) {
    console.error("Reset sales error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 })
    }

    // List completed transactions (scoped to tenant)
    const { data: transactions, error: txError } = await (supabaseAdmin as any)
      .from("pharmacy_transactions")
      .select(`
        *,
        cashier:profiles!pharmacy_transactions_cashier_id_fkey ( full_name ),
        items:pharmacy_transaction_items (
          id, quantity, unit_price, cost_price, total_price,
          package_name, package_quantity,
          batch:pharmacy_product_batches ( batch_number, expiry_date ),
          product:pharmacy_products ( id, name, sku, cost_price, dosage_form, strength )
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "COMPLETED")
      .order("created_at", { ascending: false })
      .limit(100)

    if (txError) {
      console.error("Get transactions error:", txError)
      return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
    }

    // Date boundaries
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    // Fetch period-specific transactions for profit calculation
    const [
      { data: todayTransactions },
      { data: weekTransactions },
      { data: monthTransactions },
    ] = await Promise.all([
      (supabaseAdmin as any)
        .from("pharmacy_transactions")
        .select(`
          net_amount,
          items:pharmacy_transaction_items (
            unit_price, cost_price, quantity,
            product:pharmacy_products ( cost_price )
          )
        `)
        .eq("tenant_id", tenantId)
        .eq("status", "COMPLETED")
        .gte("created_at", today.toISOString()),
      (supabaseAdmin as any)
        .from("pharmacy_transactions")
        .select(`
          net_amount,
          items:pharmacy_transaction_items (
            unit_price, cost_price, quantity,
            product:pharmacy_products ( cost_price )
          )
        `)
        .eq("tenant_id", tenantId)
        .eq("status", "COMPLETED")
        .gte("created_at", weekAgo.toISOString()),
      (supabaseAdmin as any)
        .from("pharmacy_transactions")
        .select(`
          net_amount,
          items:pharmacy_transaction_items (
            unit_price, cost_price, quantity,
            product:pharmacy_products ( cost_price )
          )
        `)
        .eq("tenant_id", tenantId)
        .eq("status", "COMPLETED")
        .gte("created_at", monthAgo.toISOString()),
    ])

    const sumNetAmount = (rows: Array<{ net_amount: number }> | null) =>
      (rows ?? []).reduce((s, r) => s + (r.net_amount ?? 0), 0)

    const sumProfit = (rows: Array<{ items: TransactionItemRow[] }> | null) =>
      (rows ?? []).reduce(
        (s, r) => s + calculateProfit(r.items ?? []),
        0
      )

    // Normalize DB snake_case → camelCase to match client Transaction interface
    const normalized = (transactions ?? []).map((tx: any) => ({
      id:              tx.id,
      transactionNo:   tx.transaction_no,
      clientName:      tx.client_name   ?? null,
      clientPhone:     tx.client_phone  ?? null,
      clientAddress:   tx.client_address ?? null,
      totalAmount:     Number(tx.total_amount  ?? 0),
      netAmount:       Number(tx.net_amount    ?? 0),
      discount:        tx.discount != null ? Number(tx.discount) : null,
      tax:             tx.tax      != null ? Number(tx.tax)      : null,
      paymentMethod:   tx.payment_method ?? "CASH",
      isEdited:        tx.is_edited ?? false,
      createdAt:       tx.created_at,
      // cashier join comes back as { full_name } — map to user.name
      user: {
        name: tx.cashier?.full_name ?? tx.cashier?.name ?? "Unknown",
      },
      items: (tx.items ?? []).map((item: any) => ({
        id:         item.id,
        quantity:   item.quantity   ?? 0,
        unitPrice:  Number(item.unit_price  ?? 0),
        costPrice:  item.cost_price != null ? Number(item.cost_price) : null,
        totalPrice: Number(item.total_price ?? 0),
        packageName:     item.package_name     ?? null,
        packageQuantity: item.package_quantity ?? null,
        batch: item.batch ? {
          batchNumber: item.batch.batch_number ?? null,
          expiryDate:  item.batch.expiry_date  ?? null,
        } : null,
        product: {
          id:          item.product?.id   ?? "",
          name:        item.product?.name ?? "Unknown product",
          sku:         item.product?.sku  ?? "",
          costPrice:   item.product?.cost_price != null ? Number(item.product.cost_price) : 0,
          dosageForm:  item.product?.dosage_form  ?? null,
          strength:    item.product?.strength     ?? null,
          expiryDate:  item.product?.expiry_date  ?? null,
          batchNumber: item.product?.batch_number ?? null,
        },
      })),
    }))

    return NextResponse.json({
      transactions: normalized,
      stats: {
        today: sumNetAmount(todayTransactions as Array<{ net_amount: number }>),
        week: sumNetAmount(weekTransactions as Array<{ net_amount: number }>),
        month: sumNetAmount(monthTransactions as Array<{ net_amount: number }>),
        todayProfit: sumProfit(
          todayTransactions as unknown as Array<{ items: TransactionItemRow[] }>
        ),
        weekProfit: sumProfit(
          weekTransactions as unknown as Array<{ items: TransactionItemRow[] }>
        ),
        monthProfit: sumProfit(
          monthTransactions as unknown as Array<{ items: TransactionItemRow[] }>
        ),
      },
    })
  } catch (error) {
    console.error("Get transactions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
