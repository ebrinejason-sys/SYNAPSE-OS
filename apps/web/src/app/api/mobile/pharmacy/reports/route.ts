import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { summarizeInventory, daysUntilExpiry, kampalaToday } from '@synapse/db/inventory'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

function rangeFor(period: string, start?: string, end?: string): { from: string; to: string } {
  const now = new Date()
  const to = end ? new Date(end) : now
  let from: Date
  switch (period) {
    case 'today':
      from = new Date(now); from.setUTCHours(0, 0, 0, 0); break
    case 'week':
      from = new Date(now.getTime() - 7 * 86_400_000); break
    case 'month':
      from = new Date(now.getTime() - 30 * 86_400_000); break
    case 'year':
      from = new Date(now.getTime() - 365 * 86_400_000); break
    case 'custom':
      from = start ? new Date(start) : new Date(now.getTime() - 30 * 86_400_000); break
    default:
      from = new Date(now); from.setUTCHours(0, 0, 0, 0)
  }
  return { from: from.toISOString(), to: to.toISOString() }
}

/** Pharmacy operational + financial report (tenant-scoped), computed from POS + inventory. */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const url = new URL(req.url)
  const period = url.searchParams.get('period') ?? 'today'
  const { from, to } = rangeFor(period, url.searchParams.get('start') ?? undefined, url.searchParams.get('end') ?? undefined)

  // Completed sales in range.
  const { data: sales } = await db()
    .from('pharmacy_pos_sales')
    .select('id, total_amount, discount_total, tax_amount, payment_method, status, created_at')
    .eq('tenant_id', auth.tenantId)
    .eq('status', 'completed')
    .gte('created_at', from)
    .lte('created_at', to)

  const saleRows = sales ?? []
  const saleIds = saleRows.map((s: any) => s.id)

  let totalSales = 0
  let totalDiscount = 0
  let totalTax = 0
  const payment = new Map<string, { total: number; count: number }>()
  for (const s of saleRows) {
    totalSales += Number(s.total_amount ?? 0)
    totalDiscount += Number(s.discount_total ?? 0)
    totalTax += Number(s.tax_amount ?? 0)
    const m = String(s.payment_method ?? 'UNKNOWN')
    const p = payment.get(m) ?? { total: 0, count: 0 }
    p.total += Number(s.total_amount ?? 0)
    p.count += 1
    payment.set(m, p)
  }
  const transactionCount = saleRows.length
  const averageTransaction = transactionCount ? Math.round(totalSales / transactionCount) : 0

  // Line items for those sales → top products + gross profit.
  const topProducts = new Map<string, { name: string; quantity: number; revenue: number; cost: number }>()
  let revenue = 0
  let cost = 0
  if (saleIds.length) {
    const { data: items } = await db()
      .from('pharmacy_pos_sale_items')
      .select('sale_id, product_id, batch_id, quantity, unit_price, discount_amount')
      .in('sale_id', saleIds)
    const rows = items ?? []
    const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))] as string[]
    const batchIds = [...new Set(rows.map((r: any) => r.batch_id).filter(Boolean))] as string[]
    const products = new Map<string, any>()
    if (productIds.length) {
      const { data } = await db().from('pharmacy_products').select('id, name, cost_price').in('id', productIds)
      for (const p of data ?? []) products.set(String(p.id), p)
    }
    const batchCost = new Map<string, number>()
    if (batchIds.length) {
      const { data } = await db().from('pharmacy_product_batches').select('id, cost_price').in('id', batchIds)
      for (const b of data ?? []) batchCost.set(String(b.id), Number(b.cost_price ?? 0))
    }
    for (const r of rows) {
      const qty = Number(r.quantity ?? 0)
      const lineRev = qty * Number(r.unit_price ?? 0) - Number(r.discount_amount ?? 0)
      const unitCost = r.batch_id && batchCost.has(String(r.batch_id))
        ? batchCost.get(String(r.batch_id))!
        : Number(products.get(String(r.product_id))?.cost_price ?? 0)
      revenue += lineRev
      cost += qty * unitCost
      const name = products.get(String(r.product_id))?.name ?? 'Unknown'
      const tp = topProducts.get(String(r.product_id)) ?? { name, quantity: 0, revenue: 0, cost: 0 }
      tp.quantity += qty
      tp.revenue += lineRev
      tp.cost += qty * unitCost
      topProducts.set(String(r.product_id), tp)
    }
  }

  // Inventory snapshot: low stock + expiring.
  const today = kampalaToday()
  const { data: catalog } = await db()
    .from('pharmacy_products')
    .select('id, name, quantity, reorder_level, is_active, pharmacy_product_batches(quantity, expiry_date, is_active)')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)

  const lowStock: Array<{ name: string; sellable: number; reorderLevel: number }> = []
  const expiring: Array<{ name: string; expiryDate: string; days: number }> = []
  for (const p of catalog ?? []) {
    const summary = summarizeInventory({ id: p.id, name: p.name, quantity: p.quantity }, p.pharmacy_product_batches ?? [], today)
    const reorder = Number(p.reorder_level ?? 0)
    if (reorder > 0 && summary.sellableQuantity <= reorder) {
      lowStock.push({ name: p.name, sellable: summary.sellableQuantity, reorderLevel: reorder })
    }
    for (const b of p.pharmacy_product_batches ?? []) {
      const d = daysUntilExpiry(b.expiry_date, today)
      if (d != null && d >= 0 && d <= 90 && Number(b.quantity ?? 0) > 0) {
        expiring.push({ name: p.name, expiryDate: String(b.expiry_date), days: d })
      }
    }
  }
  expiring.sort((a, b) => a.days - b.days)

  return NextResponse.json({
    period,
    from,
    to,
    summary: {
      totalSales,
      transactionCount,
      averageTransaction,
      totalDiscount,
      totalTax,
      grossProfit: Math.round(revenue - cost),
      profitMargin: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : 0,
    },
    paymentMix: [...payment.entries()].map(([method, v]) => ({ method, total: v.total, count: v.count })),
    topProducts: [...topProducts.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 15),
    lowStock: lowStock.slice(0, 50),
    expiring: expiring.slice(0, 50),
  })
}
