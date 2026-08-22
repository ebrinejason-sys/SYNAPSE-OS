import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'
import { adjustPharmacyBatchStock } from '@synapse/db/inventory-rpc'
import { pharmacyDomainError, httpStatusForPharmacyError } from '@synapse/db/errors'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)

  let query = db()
    .from('pharmacy_orders')
    .select(
      `
      id, order_no, status, total_amount, order_type, is_online_order,
      claimed_by, created_at, notes, delivery_address,
      customer:pharmacy_customers(name, phone),
      items:pharmacy_order_items(id, product_name, quantity, unit_price, total_price)
    `,
    )
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status.toUpperCase())

  const { data: orders, error } = await query
  if (error) {
    console.error('[mobile/pharmacy/orders]', error.message)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }

  const pending = (orders ?? []).filter((o: { status: string }) => o.status === 'PENDING').length
  const processing = (orders ?? []).filter((o: { status: string }) => o.status === 'PROCESSING').length

  return NextResponse.json({
    orders: (orders ?? []).map((o: Record<string, unknown>) => ({
      id: o.id,
      orderNo: o.order_no,
      status: o.status,
      totalAmount: Number(o.total_amount ?? 0),
      orderType: o.order_type,
      isOnline: Boolean(o.is_online_order),
      claimedBy: o.claimed_by ?? null,
      createdAt: o.created_at,
      notes: o.notes ?? null,
      deliveryAddress: o.delivery_address ?? null,
      customerName: (o.customer as { name?: string } | null)?.name ?? null,
      customerPhone: (o.customer as { phone?: string } | null)?.phone ?? null,
      items: ((o.items as Array<Record<string, unknown>>) ?? []).map((i) => ({
        id: i.id,
        productName: i.product_name,
        quantity: Number(i.quantity ?? 0),
        unitPrice: Number(i.unit_price ?? 0),
        totalPrice: Number(i.total_price ?? 0),
      })),
    })),
    summary: { pending, processing, total: orders?.length ?? 0 },
  })
}

/** Claim (→ PROCESSING) or set status COMPLETED / CANCELLED. */
export async function PATCH(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const body = (await req.json().catch(() => ({}))) as {
    orderId?: string
    action?: 'claim' | 'complete' | 'cancel'
  }

  if (!body.orderId || !body.action) {
    return NextResponse.json({ error: 'orderId and action required' }, { status: 400 })
  }

  const { data: order, error: fetchErr } = await db()
    .from('pharmacy_orders')
    .select(
      'id, order_no, status, claimed_by, order_type, total_amount, items:pharmacy_order_items(id, product_id, product_name, quantity, unit_price, total_price)',
    )
    .eq('tenant_id', auth.tenantId)
    .eq('id', body.orderId)
    .maybeSingle()

  if (fetchErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (body.action === 'claim') {
    if (order.claimed_by) {
      return NextResponse.json({ error: 'Order already claimed' }, { status: 409 })
    }
    if (order.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending orders can be claimed' }, { status: 400 })
    }
    const { error } = await db()
      .from('pharmacy_orders')
      .update({
        claimed_by: auth.userId,
        claimed_at: new Date().toISOString(),
        status: 'PROCESSING',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('tenant_id', auth.tenantId)

    if (error) return NextResponse.json({ error: 'Failed to claim' }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'PROCESSING' })
  }

  if (body.action === 'cancel') {
    if (!['PENDING', 'PROCESSING'].includes(order.status)) {
      return NextResponse.json({ error: 'Cannot cancel this order' }, { status: 400 })
    }
    const { error } = await db()
      .from('pharmacy_orders')
      .update({
        status: 'CANCELLED',
        processed_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('tenant_id', auth.tenantId)
    if (error) return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'CANCELLED' })
  }

  if (body.action === 'complete') {
    if (!['PENDING', 'PROCESSING'].includes(order.status)) {
      return NextResponse.json({ error: 'Cannot complete this order' }, { status: 400 })
    }

    const { error } = await db()
      .from('pharmacy_orders')
      .update({
        status: 'COMPLETED',
        processed_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('tenant_id', auth.tenantId)

    if (error) return NextResponse.json({ error: 'Failed to complete' }, { status: 500 })

    // Deduct sellable batch stock via FEFO (never product.quantity).
    if (order.order_type === 'CUSTOMER') {
      const items = (order.items as Array<{
        product_id: string | null
        quantity: number
        product_name: string
      }>).filter((i) => i.product_id)

      for (const item of items) {
        const debit = await adjustPharmacyBatchStock(db(), {
          tenantId: auth.tenantId,
          productId: item.product_id as string,
          quantity: Number(item.quantity ?? 0),
          type: 'DECREASE',
          reason: `Order ${order.order_no} completed (mobile)`,
          actorId: auth.userId,
        })
        if (debit.error) {
          return NextResponse.json(
            pharmacyDomainError(debit.error.code, debit.error.humanMessage, {
              productId: item.product_id ?? undefined,
              requestedQuantity: Number(item.quantity ?? 0),
            }),
            { status: httpStatusForPharmacyError(debit.error.code) },
          )
        }
      }
    }

    return NextResponse.json({ ok: true, status: 'COMPLETED' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
