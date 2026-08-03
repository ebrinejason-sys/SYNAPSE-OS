import { NextRequest, NextResponse } from "next/server"
import { requirePharmacyAdmin, requirePharmacyPermission } from "@/lib/api-auth"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { listLedgerSalesForHistory, sumCompletedRevenue } from "@/lib/pos/sale-ledger"

interface TransactionItemRow {
  unitPrice: number
  costPrice: number | null
  quantity: number
  product?: { costPrice?: number | null } | null
}

function calculateProfit(items: TransactionItemRow[]): number {
  return items.reduce((total, item) => {
    const costAtSale = item.costPrice ?? item.product?.costPrice ?? 0
    const profit = (item.unitPrice - costAtSale) * Math.abs(item.quantity)
    return total + profit
  }, 0)
}

// Reset all sales/transactions (Admin only)
export async function DELETE(_request: NextRequest) {
  try {
    const auth = await requirePharmacyAdmin()
    if (!auth.ok) return auth.response
    const { session, tenantId } = auth

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 })
    }

    await (supabaseAdmin as any)
      .from("pharmacy_pos_sale_items")
      .delete()
      .eq("tenant_id", tenantId)

    const { data: deletedPos, error: posErr } = await (supabaseAdmin as any)
      .from("pharmacy_pos_sales")
      .delete()
      .eq("tenant_id", tenantId)
      .select("id")

    if (posErr) {
      console.error("Delete pos sales error:", posErr)
      return NextResponse.json({ error: "Failed to delete POS sales" }, { status: 500 })
    }

    await supabaseAdmin.from("pharmacy_transaction_items").delete().eq("tenant_id", tenantId)

    const { data: deletedRows, error: txError } = await supabaseAdmin
      .from("pharmacy_transactions")
      .delete()
      .eq("tenant_id", tenantId)
      .select("id")

    if (txError) {
      console.error("Delete transactions error:", txError)
      return NextResponse.json({ error: "Failed to delete transactions" }, { status: 500 })
    }

    const deletedCount = (deletedPos?.length ?? 0) + (deletedRows?.length ?? 0)

    await supabaseAdmin.from("pharmacy_audit_logs").insert({
      tenant_id: tenantId,
      profile_id: session.user.id,
      action: "RESET_SALES",
      entity: "TRANSACTION",
      details: `Reset all sales. Deleted ${deletedCount} sales (POS + order).`,
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

export async function GET(_request: NextRequest) {
  try {
    const auth = await requirePharmacyPermission(["reports.operational", "pos.sell"])
    if (!auth.ok) return auth.response
    const { tenantId } = auth

    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 })
    }

    const ledger = await listLedgerSalesForHistory({ tenantId, limit: 100 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    const [todayRev, weekRev, monthRev] = await Promise.all([
      sumCompletedRevenue({ tenantId, fromIso: today.toISOString() }),
      sumCompletedRevenue({ tenantId, fromIso: weekAgo.toISOString() }),
      sumCompletedRevenue({ tenantId, fromIso: monthAgo.toISOString() }),
    ])

    const inPeriod = (iso: string, from: Date) => Date.parse(iso) >= from.getTime()

    const profitFor = (from: Date) =>
      ledger
        .filter((r) => r.status === "COMPLETED" && inPeriod(r.createdAt, from))
        .reduce(
          (s, r) =>
            s +
            calculateProfit(
              r.items.map((i) => ({
                unitPrice: i.unitPrice,
                costPrice: i.costPrice,
                quantity: i.quantity,
                product: i.product ? { costPrice: i.product.cost_price ?? null } : null,
              })),
            ),
          0,
        )

    const normalized = ledger.map((row) => ({
      id: row.id,
      transactionNo: row.transactionNo,
      clientName: row.clientName,
      clientPhone: null,
      clientAddress: null,
      totalAmount: row.subtotal,
      netAmount: row.netAmount,
      discount: row.discount,
      tax: row.tax,
      paymentMethod: row.paymentMethod ?? "CASH",
      isEdited: false,
      createdAt: row.createdAt,
      source: row.source,
      user: { name: row.cashierName ?? "Unknown" },
      items: row.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        totalPrice: item.totalPrice,
        packageName: null,
        packageQuantity: null,
        batch: item.batch
          ? {
              batchNumber: item.batch.batch_number,
              expiryDate: item.batch.expiry_date,
            }
          : null,
        product: {
          id: item.product?.id ?? "",
          name: item.product?.name ?? "Unknown product",
          sku: item.product?.sku ?? "",
          costPrice: item.product?.cost_price != null ? Number(item.product.cost_price) : 0,
          dosageForm: null,
          strength: null,
          expiryDate: null,
          batchNumber: null,
        },
      })),
    }))

    return NextResponse.json({
      transactions: normalized,
      stats: {
        today: todayRev.amount,
        week: weekRev.amount,
        month: monthRev.amount,
        todayProfit: profitFor(today),
        weekProfit: profitFor(weekAgo),
        monthProfit: profitFor(monthAgo),
        count: normalized.length,
      },
    })
  } catch (error) {
    console.error("Get transactions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
