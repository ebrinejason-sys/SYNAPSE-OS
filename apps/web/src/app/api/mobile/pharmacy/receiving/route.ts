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

/**
 * Goods-received-note / stock receiving. New sellable stock enters ONLY through a real batch
 * (Phase-1 rule) via the `receive_pharmacy_stock` RPC — requires a genuine batch number,
 * positive quantity and a future expiry date. Accepts one or more lines.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (!isMobilePharmacyAdmin(auth)) {
    return NextResponse.json({ error: 'Admin role required to receive stock' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    supplierRef?: string
    lines?: Array<{ productId: string; batchNumber: string; quantity: number; expiryDate: string; costPrice?: number }>
  } | null

  const lines = body?.lines ?? []
  if (lines.length === 0) return NextResponse.json({ error: 'At least one line is required' }, { status: 400 })

  const results: Array<{ productId: string; ok: boolean; batchId?: string; error?: string }> = []
  for (const line of lines) {
    if (!line.productId || !line.batchNumber || !line.expiryDate || !(Number(line.quantity) > 0)) {
      results.push({ productId: line.productId, ok: false, error: 'Missing batch number, quantity or expiry' })
      continue
    }
    const { data, error } = await db().rpc('receive_pharmacy_stock', {
      p_tenant_id: auth.tenantId,
      p_product_id: line.productId,
      p_batch_number: line.batchNumber,
      p_quantity: Math.trunc(Number(line.quantity)),
      p_expiry_date: line.expiryDate,
      p_cost_price: line.costPrice ?? null,
      p_received_by: auth.userId,
      p_supplier_ref: body?.supplierRef ?? null,
    })
    if (error) {
      results.push({ productId: line.productId, ok: false, error: error.message ?? 'Receiving failed' })
    } else {
      results.push({ productId: line.productId, ok: true, batchId: data?.batch_id })
    }
  }

  const anyOk = results.some((r) => r.ok)
  return NextResponse.json({ ok: anyOk, results }, { status: anyOk ? 200 : 400 })
}
