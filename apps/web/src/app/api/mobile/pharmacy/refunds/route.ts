import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { reversePharmacySale } from '@synapse/db/inventory-rpc'
import { canDo } from '../../../../../lib/capability-map'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
  type MobileAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/** Mirror portal pos.refund: store managers, admins/CEO, finance. */
const REFUND_ROLES = new Set([
  'pharmacy_admin',
  'pharmacy_ceo',
  'pharmacy_store_manager',
  'finance',
])

function canRefund(auth: MobileAuth): boolean {
  if (REFUND_ROLES.has(auth.role)) return true
  return canDo(auth.role, 'pos', 'refund', 'write')
}

/** GET — list voided POS sales for the tenant. */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  if (!canRefund(auth)) {
    return NextResponse.json(
      { error: 'Refund permission required (pos.refund)' },
      { status: 403 },
    )
  }

  const { data: posVoids, error } = await db()
    .from('pharmacy_pos_sales')
    .select(
      `
      id, receipt_number, total_amount, payment_method, cashier_id, status,
      voided_reason, voided_at, updated_at, created_at,
      items:pharmacy_pos_sale_items (
        id, quantity, unit_price, product:pharmacy_products ( name, sku )
      )
    `,
    )
    .eq('tenant_id', auth.tenantId)
    .eq('status', 'voided')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[mobile/pharmacy/refunds GET]', error.message)
    return NextResponse.json({ error: 'Failed to fetch refunds' }, { status: 500 })
  }

  return NextResponse.json({
    refunds: (posVoids ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      receiptNumber: s.receipt_number,
      totalAmount: Number(s.total_amount ?? 0),
      paymentMethod: s.payment_method,
      status: 'voided',
      reason: s.voided_reason,
      voidedAt: s.voided_at ?? s.updated_at,
      createdAt: s.created_at,
      items: s.items ?? [],
    })),
  })
}

/** POST — void a completed POS sale via reversePharmacySale (default restore quarantined). */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  if (!canRefund(auth)) {
    return NextResponse.json(
      { error: 'Refund permission required (pos.refund)' },
      { status: 403 },
    )
  }

  const body = (await req.json().catch(() => null)) as {
    saleId?: string
    reason?: string
    restoreAs?: 'active' | 'quarantined'
  } | null

  const saleId = typeof body?.saleId === 'string' ? body.saleId.trim() : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const restoreAs = body?.restoreAs === 'active' ? 'active' : 'quarantined'

  if (!saleId) {
    return NextResponse.json({ error: 'saleId is required' }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 })
  }

  const { data, error } = await reversePharmacySale(db(), {
    tenantId: auth.tenantId,
    saleId,
    actorId: auth.userId,
    reason,
    restoreAs,
  })

  if (error) {
    const status =
      error.code === 'ALREADY_REFUNDED'
        ? 409
        : error.code === 'PRODUCT_NOT_FOUND'
          ? 404
          : 400
    return NextResponse.json(
      { error: error.humanMessage, code: error.code, detail: error.message },
      { status },
    )
  }

  return NextResponse.json({
    ok: true,
    saleId: (data as any)?.sale_id ?? saleId,
    receiptNumber: (data as any)?.receipt_number,
    refundAmount: Number((data as any)?.refund_amount ?? 0),
    restoreAs: (data as any)?.restore_as ?? restoreAs,
    status: (data as any)?.status ?? 'voided',
  })
}
