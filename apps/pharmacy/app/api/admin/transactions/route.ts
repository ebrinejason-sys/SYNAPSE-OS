import { NextRequest, NextResponse } from "next/server"
import { getPharmacySession, isPharmacyAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
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
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isPharmacyAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized - Admin only" }, { status: 401 })
    }

    const tenantId = session.profile.tenant_id
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
    const session = await getPharmacySession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    // List completed transactions (RLS filters by tenant automatically)
    const { data: transactions, error: txError } = await supabase
      .from("pharmacy_transactions")
      .select(`
        *,
        cashier:profiles!pharmacy_transactions_cashier_id_fkey ( full_name ),
        items:pharmacy_transaction_items (
          *,
          product:pharmacy_products ( name, sku, cost_price )
        )
      `)
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
      supabase
        .from("pharmacy_transactions")
        .select(`
          net_amount,
          items:pharmacy_transaction_items (
            unit_price, cost_price, quantity,
            product:pharmacy_products ( cost_price )
          )
        `)
        .eq("status", "COMPLETED")
        .gte("created_at", today.toISOString()),
      supabase
        .from("pharmacy_transactions")
        .select(`
          net_amount,
          items:pharmacy_transaction_items (
            unit_price, cost_price, quantity,
            product:pharmacy_products ( cost_price )
          )
        `)
        .eq("status", "COMPLETED")
        .gte("created_at", weekAgo.toISOString()),
      supabase
        .from("pharmacy_transactions")
        .select(`
          net_amount,
          items:pharmacy_transaction_items (
            unit_price, cost_price, quantity,
            product:pharmacy_products ( cost_price )
          )
        `)
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

    return NextResponse.json({
      transactions: transactions ?? [],
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
