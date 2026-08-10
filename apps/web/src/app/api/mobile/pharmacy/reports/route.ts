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

function rangeFor(
  period: string,
  start?: string | null,
  end?: string | null,
): { from: string; to: string } {
  const now = new Date()
  const to = end ? new Date(end) : now
  let from: Date
  switch (period) {
    case 'today':
      from = new Date(now)
      from.setUTCHours(0, 0, 0, 0)
      break
    case 'week':
      from = new Date(now.getTime() - 7 * 86_400_000)
      break
    case 'month':
      from = new Date(now.getTime() - 30 * 86_400_000)
      break
    case 'year':
      from = new Date(now.getTime() - 365 * 86_400_000)
      break
    case 'custom':
      from = start ? new Date(start) : new Date(now.getTime() - 30 * 86_400_000)
      break
    default:
      from = new Date(now)
      from.setUTCHours(0, 0, 0, 0)
  }
  // If explicit from/to ISO dates were provided (YYYY-MM-DD), prefer them.
  if (start && /^\d{4}-\d{2}-\d{2}/.test(start)) {
    from = new Date(`${start.slice(0, 10)}T00:00:00.000Z`)
  }
  if (end && /^\d{4}-\d{2}-\d{2}/.test(end)) {
    to.setTime(new Date(`${end.slice(0, 10)}T23:59:59.999Z`).getTime())
  }
  return { from: from.toISOString(), to: to.toISOString() }
}

async function buildOperationalReport(tenantId: string, from: string, to: string, period: string) {
  const { data: sales, error: salesError } = await db()
    .from('pharmacy_pos_sales')
    .select('id, total_amount, discount_total, tax_amount, payment_method, status, created_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .gte('created_at', from)
    .lte('created_at', to)

  if (salesError) {
    console.error('[mobile/reports] sales', salesError.message)
  }

  const saleRows = sales ?? []
  const saleIds = saleRows.map((s: { id: string }) => s.id)

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

  const topProducts = new Map<string, { name: string; quantity: number; revenue: number; cost: number }>()
  let revenue = 0
  let cost = 0
  if (saleIds.length) {
    const { data: items } = await db()
      .from('pharmacy_pos_sale_items')
      .select('sale_id, product_id, batch_id, quantity, unit_price, discount_amount')
      .in('sale_id', saleIds)
    const rows = items ?? []
    const productIds = [...new Set(rows.map((r: { product_id: string }) => r.product_id).filter(Boolean))] as string[]
    const batchIds = [...new Set(rows.map((r: { batch_id: string | null }) => r.batch_id).filter(Boolean))] as string[]
    const products = new Map<string, { id: string; name: string; cost_price: number | null }>()
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
      const unitCost =
        r.batch_id && batchCost.has(String(r.batch_id))
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

  const today = kampalaToday()
  const { data: catalog } = await db()
    .from('pharmacy_products')
    .select('id, name, quantity, reorder_level, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  const productIds = (catalog ?? []).map((p: { id: string }) => p.id)
  const batchesByProduct = new Map<string, Array<{ quantity: number; expiry_date: string | null; is_active: boolean }>>()
  if (productIds.length) {
    const { data: batches } = await db()
      .from('pharmacy_product_batches')
      .select('product_id, quantity, expiry_date, is_active, status')
      .eq('tenant_id', tenantId)
      .in('product_id', productIds)
    for (const b of batches ?? []) {
      const list = batchesByProduct.get(String(b.product_id)) ?? []
      list.push(b)
      batchesByProduct.set(String(b.product_id), list)
    }
  }

  const lowStock: Array<{ name: string; sellable: number; reorderLevel: number }> = []
  const expiring: Array<{ name: string; expiryDate: string; days: number }> = []
  for (const p of catalog ?? []) {
    const batches = batchesByProduct.get(String(p.id)) ?? []
    const summary = summarizeInventory({ id: p.id, name: p.name, quantity: p.quantity }, batches, today)
    const reorder = Number(p.reorder_level ?? 0)
    if (reorder > 0 && summary.sellableQuantity <= reorder) {
      lowStock.push({ name: p.name, sellable: summary.sellableQuantity, reorderLevel: reorder })
    }
    for (const b of batches) {
      const d = daysUntilExpiry(b.expiry_date, today)
      if (d != null && d >= 0 && d <= 90 && Number(b.quantity ?? 0) > 0) {
        expiring.push({ name: p.name, expiryDate: String(b.expiry_date), days: d })
      }
    }
  }
  expiring.sort((a, b) => a.days - b.days)

  return {
    period,
    from,
    to,
    type: 'operational',
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
    // Aliases for typed report screens
    rows: [...topProducts.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 25),
  }
}

/** Pharmacy operational + financial report (tenant-scoped). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireMobilePharmacyAuth(req)
    if (!isMobileAuth(auth)) return auth

    const url = new URL(req.url)
    const type = url.searchParams.get('type') // sales|inventory|low-stock|expiry|refunds|operational
    const period = url.searchParams.get('period') ?? (type ? 'custom' : 'today')
    const fromParam = url.searchParams.get('from') ?? url.searchParams.get('start')
    const toParam = url.searchParams.get('to') ?? url.searchParams.get('end')
    const { from, to } = rangeFor(period, fromParam, toParam)

    const report = await buildOperationalReport(auth.tenantId, from, to, period)

    // Typed subsets for (main)/reports.tsx
    if (type === 'sales') {
      return NextResponse.json({
        type: 'sales',
        from,
        to,
        summary: report.summary,
        paymentMix: report.paymentMix,
        topProducts: report.topProducts,
        rows: report.topProducts,
      })
    }
    if (type === 'inventory' || type === 'low-stock') {
      return NextResponse.json({
        type,
        from,
        to,
        summary: { lowStockCount: report.lowStock.length },
        lowStock: report.lowStock,
        rows: report.lowStock,
      })
    }
    if (type === 'expiry') {
      return NextResponse.json({
        type: 'expiry',
        from,
        to,
        summary: { expiringCount: report.expiring.length },
        expiring: report.expiring,
        rows: report.expiring,
      })
    }
    if (type === 'refunds') {
      const { data: voids } = await db()
        .from('pharmacy_pos_sales')
        .select('id, receipt_number, total_amount, voided_reason, voided_at, updated_at')
        .eq('tenant_id', auth.tenantId)
        .eq('status', 'voided')
        .gte('updated_at', from)
        .lte('updated_at', to)
        .order('updated_at', { ascending: false })
        .limit(100)
      const rows = (voids ?? []).map((v: any) => ({
        id: v.id,
        receiptNumber: v.receipt_number,
        amount: Number(v.total_amount ?? 0),
        reason: v.voided_reason,
        at: v.voided_at ?? v.updated_at,
      }))
      return NextResponse.json({
        type: 'refunds',
        from,
        to,
        summary: { refundCount: rows.length, refundTotal: rows.reduce((s: number, r: any) => s + r.amount, 0) },
        rows,
      })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('[mobile/pharmacy/reports]', error)
    return NextResponse.json(
      { error: 'Could not build report. Try again or pick a shorter period.' },
      { status: 500 },
    )
  }
}
