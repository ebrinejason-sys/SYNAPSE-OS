import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/** Recent POS sales for pharmacy staff (read-only). */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? '40'), 100)

  const { data: sales, error } = await db()
    .from('pharmacy_pos_sales')
    .select(
      'id, receipt_number, status, total_amount, payment_method, created_at, cashier_id',
    )
    .eq('tenant_id', auth.tenantId)
    .in('status', ['completed', 'voided'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[mobile/pharmacy/sales]', error.message)
    return NextResponse.json({ error: 'Failed to load sales' }, { status: 500 })
  }

  const cashierIds = [
    ...new Set((sales ?? []).map((s: { cashier_id?: string }) => s.cashier_id).filter(Boolean)),
  ] as string[]
  const names = new Map<string, string>()
  if (cashierIds.length) {
    const { data: profiles } = await db()
      .from('profiles')
      .select('id, full_name')
      .in('id', cashierIds)
    for (const p of profiles ?? []) names.set(p.id, p.full_name ?? '')
  }

  return NextResponse.json({
    sales: (sales ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      receiptNumber: s.receipt_number,
      status: String(s.status ?? '').toUpperCase(),
      totalAmount: Number(s.total_amount ?? 0),
      paymentMethod: s.payment_method ?? null,
      createdAt: s.created_at,
      cashierName: s.cashier_id ? names.get(String(s.cashier_id)) ?? null : null,
    })),
  })
}
