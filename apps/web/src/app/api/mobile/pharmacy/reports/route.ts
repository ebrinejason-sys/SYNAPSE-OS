import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

const REPORT_TYPES = new Set(['sales', 'inventory', 'low-stock', 'expiry', 'refunds'])

/**
 * GET — mobile-friendly pharmacy reports.
 * Query: type=sales|inventory|low-stock|expiry|refunds, from=, to=
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const params = new URL(req.url).searchParams
  const reportType = params.get('type') || 'sales'
  if (!REPORT_TYPES.has(reportType)) {
    return NextResponse.json(
      { error: 'Invalid type. Use sales|inventory|low-stock|expiry|refunds' },
      { status: 400 },
    )
  }

  const fromParam = params.get('from')
  const toParam = params.get('to')
  const dateFrom = fromParam
    ? new Date(fromParam)
    : new Date(new Date().setHours(0, 0, 0, 0))
  const dateTo = toParam ? new Date(toParam) : new Date()
  // Include full end day when date-only
  if (toParam && toParam.length <= 10) {
    dateTo.setHours(23, 59, 59, 999)
  }

  const dateFromISO = dateFrom.toISOString()
  const dateToISO = dateTo.toISOString()
  const tenantId = auth.tenantId

  try {
    if (reportType === 'sales') {
      const [posResult, posItemsResult] = await Promise.all([
        db()
          .from('pharmacy_pos_sales')
          .select(
            'id, receipt_number, total_amount, discount_total, tax_amount, payment_method, cashier_id, created_at',
          )
          .eq('tenant_id', tenantId)
          .eq('status', 'completed')
          .gte('created_at', dateFromISO)
          .lte('created_at', dateToISO)
          .order('created_at', { ascending: false })
          .limit(200),
        db()
          .from('pharmacy_pos_sale_items')
          .select(
            'product_id, quantity, unit_price, discount_amount, line_total, pharmacy_pos_sales!inner(status, created_at), pharmacy_products(name, sku, category)',
          )
          .eq('tenant_id', tenantId)
          .eq('pharmacy_pos_sales.status', 'completed')
          .gte('pharmacy_pos_sales.created_at', dateFromISO)
          .lte('pharmacy_pos_sales.created_at', dateToISO),
      ])

      if (posResult.error) {
        console.error('[mobile/pharmacy/reports sales]', posResult.error.message)
        return NextResponse.json({ error: 'Failed to load sales report' }, { status: 500 })
      }

      const transactions = (posResult.data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id,
        receiptNumber: s.receipt_number,
        totalAmount: Number(s.total_amount ?? 0),
        discount: Number(s.discount_total ?? 0),
        tax: Number(s.tax_amount ?? 0),
        paymentMethod: s.payment_method,
        createdAt: s.created_at,
      }))

      let totalSales = 0
      let totalDiscount = 0
      const byPayment = new Map<string, { method: string; total: number; count: number }>()
      for (const tx of transactions) {
        totalSales += tx.totalAmount
        totalDiscount += tx.discount
        const method = String(tx.paymentMethod ?? 'UNKNOWN')
        const existing = byPayment.get(method) ?? { method, total: 0, count: 0 }
        existing.total += tx.totalAmount
        existing.count += 1
        byPayment.set(method, existing)
      }

      const topProductsMap = new Map<
        string,
        { productId: string; name: string; quantity: number; total: number }
      >()
      for (const item of posItemsResult.data ?? []) {
        const pid = String(item.product_id ?? 'unknown')
        const product = item.pharmacy_products as { name?: string } | null
        const lineTotal =
          item.line_total != null
            ? Number(item.line_total)
            : Number(item.quantity ?? 0) * Number(item.unit_price ?? 0) -
              Number(item.discount_amount ?? 0)
        const existing = topProductsMap.get(pid) ?? {
          productId: pid,
          name: product?.name ?? 'Unknown',
          quantity: 0,
          total: 0,
        }
        existing.quantity += Number(item.quantity ?? 0)
        existing.total += lineTotal
        topProductsMap.set(pid, existing)
      }

      return NextResponse.json({
        type: 'sales',
        from: dateFromISO,
        to: dateToISO,
        summary: {
          totalSales,
          totalDiscount,
          transactionCount: transactions.length,
          averageTransaction:
            transactions.length > 0 ? totalSales / transactions.length : 0,
        },
        salesByPaymentMethod: Array.from(byPayment.values()),
        topProducts: Array.from(topProductsMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 15),
        transactions: transactions.slice(0, 100),
      })
    }

    if (reportType === 'inventory' || reportType === 'low-stock' || reportType === 'expiry') {
      const { data: settingsRow } = await db()
        .from('pharmacy_settings')
        .select('low_stock_threshold')
        .eq('tenant_id', tenantId)
        .maybeSingle()
      const lowStockThreshold = settingsRow?.low_stock_threshold ?? 10
      const nowISO = new Date().toISOString()
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: allProducts, error } = await db()
        .from('pharmacy_products')
        .select(
          'id, name, sku, category, quantity, cost_price, price, reorder_level, expiry_date, is_active',
        )
        .eq('tenant_id', tenantId)
        .eq('is_active', true)

      if (error) {
        console.error('[mobile/pharmacy/reports inventory]', error.message)
        return NextResponse.json({ error: 'Failed to load inventory report' }, { status: 500 })
      }

      const products = (allProducts ?? []) as Array<Record<string, unknown>>
      const lowStock = products.filter(
        (p) => Number(p.quantity ?? 0) > 0 && Number(p.quantity ?? 0) <= lowStockThreshold,
      )
      const outOfStock = products.filter((p) => Number(p.quantity ?? 0) <= 0)
      const expiring = products.filter((p) => {
        const exp = p.expiry_date as string | null
        return exp && exp >= nowISO && exp <= thirtyDays
      })
      const expired = products.filter((p) => {
        const exp = p.expiry_date as string | null
        return exp && exp < nowISO
      })

      const mapProduct = (p: Record<string, unknown>) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        quantity: Number(p.quantity ?? 0),
        costPrice: Number(p.cost_price ?? 0),
        price: Number(p.price ?? 0),
        reorderLevel: Number(p.reorder_level ?? 0),
        expiryDate: p.expiry_date ?? null,
      })

      if (reportType === 'low-stock') {
        return NextResponse.json({
          type: 'low-stock',
          from: dateFromISO,
          to: dateToISO,
          summary: {
            lowStockCount: lowStock.length,
            outOfStockCount: outOfStock.length,
            threshold: lowStockThreshold,
          },
          lowStockProducts: lowStock.map(mapProduct),
          outOfStockProducts: outOfStock.map(mapProduct),
        })
      }

      if (reportType === 'expiry') {
        return NextResponse.json({
          type: 'expiry',
          from: dateFromISO,
          to: dateToISO,
          summary: {
            expiringCount: expiring.length,
            expiredCount: expired.length,
          },
          expiringProducts: expiring.map(mapProduct),
          expiredProducts: expired.map(mapProduct),
        })
      }

      const totalUnits = products.reduce((s, p) => s + Number(p.quantity ?? 0), 0)
      const inventoryValueAtCost = products.reduce(
        (s, p) => s + Number(p.quantity ?? 0) * Number(p.cost_price ?? 0),
        0,
      )
      const inventoryValueAtRetail = products.reduce(
        (s, p) => s + Number(p.quantity ?? 0) * Number(p.price ?? 0),
        0,
      )

      return NextResponse.json({
        type: 'inventory',
        from: dateFromISO,
        to: dateToISO,
        summary: {
          totalProducts: products.length,
          totalUnits,
          inventoryValueAtCost,
          inventoryValueAtRetail,
          potentialProfit: inventoryValueAtRetail - inventoryValueAtCost,
          lowStockCount: lowStock.length,
          outOfStockCount: outOfStock.length,
          expiringCount: expiring.length,
          expiredCount: expired.length,
        },
        lowStockProducts: lowStock.slice(0, 50).map(mapProduct),
        expiringProducts: expiring.slice(0, 50).map(mapProduct),
      })
    }

    // refunds
    const { data: voids, error: voidError } = await db()
      .from('pharmacy_pos_sales')
      .select(
        'id, receipt_number, total_amount, payment_method, voided_reason, voided_at, updated_at, created_at',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'voided')
      .gte('updated_at', dateFromISO)
      .lte('updated_at', dateToISO)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (voidError) {
      console.error('[mobile/pharmacy/reports refunds]', voidError.message)
      return NextResponse.json({ error: 'Failed to load refunds report' }, { status: 500 })
    }

    const refunds = (voids ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      receiptNumber: s.receipt_number,
      totalAmount: Number(s.total_amount ?? 0),
      paymentMethod: s.payment_method,
      reason: s.voided_reason,
      voidedAt: s.voided_at ?? s.updated_at,
      createdAt: s.created_at,
    }))
    const totalRefunded = refunds.reduce(
      (s: number, r: { totalAmount: number }) => s + r.totalAmount,
      0,
    )

    return NextResponse.json({
      type: 'refunds',
      from: dateFromISO,
      to: dateToISO,
      summary: {
        refundCount: refunds.length,
        totalRefunded,
      },
      refunds,
    })
  } catch (error) {
    console.error('[mobile/pharmacy/reports]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
