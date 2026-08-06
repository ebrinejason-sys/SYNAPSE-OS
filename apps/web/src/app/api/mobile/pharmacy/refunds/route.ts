import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  isMobilePharmacyAdmin,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/** GET — list voided/refunded POS sales for this tenant. */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { data } = await db()
    .from('pharmacy_pos_sales')
    .select('id, receipt_number, total_amount, payment_method, status, voided_reason, voided_at, created_at')
    .eq('tenant_id', auth.tenantId)
    .eq('status', 'voided')
    .order('voided_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    canRefund: isMobilePharmacyAdmin(auth),
    refunds: (data ?? []).map((s: any) => ({
      id: s.id,
      receiptNumber: s.receipt_number,
      amount: Number(s.total_amount ?? 0),
      paymentMethod: s.payment_method,
      reason: s.voided_reason ?? null,
      voidedAt: s.voided_at ?? null,
      createdAt: s.created_at,
    })),
  })
}

/**
 * POST — refund/void a completed POS sale: restores batch + product quantities, records a
 * stock adjustment, and marks the sale voided. Admin-only.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (!isMobilePharmacyAdmin(auth)) return NextResponse.json({ error: 'Admin role required' }, { status: 403 })

  const { saleId, reason } = (await req.json().catch(() => ({}))) as { saleId?: string; reason?: string }
  if (!saleId) return NextResponse.json({ error: 'saleId is required' }, { status: 400 })

  const { data: sale } = await db()
    .from('pharmacy_pos_sales')
    .select('id, receipt_number, status, items:pharmacy_pos_sale_items(id, product_id, batch_id, quantity, unit_price)')
    .eq('tenant_id', auth.tenantId)
    .eq('id', saleId)
    .maybeSingle()

  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  if (sale.status === 'voided') return NextResponse.json({ error: 'Sale already refunded' }, { status: 400 })
  if (sale.status !== 'completed') return NextResponse.json({ error: `Cannot refund sale in status ${sale.status}` }, { status: 400 })

  const items = (sale.items ?? []) as Array<{ id: string; product_id: string; batch_id: string | null; quantity: number; unit_price: number }>
  let refundAmount = 0

  for (const it of items) {
    const qty = Number(it.quantity ?? 0)
    refundAmount += Number(it.unit_price ?? 0) * qty
    if (it.batch_id) {
      const { data: batch } = await db().from('pharmacy_product_batches').select('quantity').eq('id', it.batch_id).eq('tenant_id', auth.tenantId).maybeSingle()
      if (batch) {
        await db().from('pharmacy_product_batches').update({ quantity: Number(batch.quantity ?? 0) + qty, updated_at: new Date().toISOString() }).eq('id', it.batch_id).eq('tenant_id', auth.tenantId)
      }
    }
    if (it.product_id) {
      const { data: product } = await db().from('pharmacy_products').select('quantity').eq('id', it.product_id).eq('tenant_id', auth.tenantId).maybeSingle()
      if (product) {
        const prev = Number(product.quantity ?? 0)
        const next = prev + qty
        await db().from('pharmacy_products').update({ quantity: next, updated_at: new Date().toISOString() }).eq('id', it.product_id).eq('tenant_id', auth.tenantId)
        try {
          await db().from('pharmacy_stock_adjustments').insert({
            tenant_id: auth.tenantId,
            product_id: it.product_id,
            quantity: qty,
            type: 'INCREASE',
            reason: `Refund from POS sale ${sale.receipt_number}: ${reason ?? 'No reason provided'}`,
            previous_qty: prev,
            new_qty: next,
            created_by: auth.userId,
          })
        } catch {
          /* adjustments table optional */
        }
      }
    }
  }

  const { error: updErr } = await db()
    .from('pharmacy_pos_sales')
    .update({
      status: 'voided',
      voided_reason: reason ?? 'Refund',
      voided_by: auth.userId,
      voided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', saleId)
    .eq('tenant_id', auth.tenantId)
  if (updErr) return NextResponse.json({ error: 'Failed to void sale' }, { status: 500 })

  try {
    await db().from('pharmacy_audit_logs').insert({
      tenant_id: auth.tenantId,
      profile_id: auth.userId,
      action: 'REFUND_POS_SALE',
      entity: 'POS_SALE',
      entity_id: saleId,
      details: { receiptNumber: sale.receipt_number, refundAmount, reason: reason ?? null, source: 'mobile' },
    })
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true, refundAmount })
}
