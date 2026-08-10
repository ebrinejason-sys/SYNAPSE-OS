import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { receivePharmacyStock } from '@synapse/db/inventory-rpc'
import {
  isMobileAuth,
  isMobilePharmacyAdmin,
  requireMobilePharmacyAuth,
  type MobileAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

const INVENTORY_WRITE_ROLES = new Set([
  'pharmacy_admin',
  'pharmacy_ceo',
  'pharmacist',
  'pharmacy_store_manager',
  'pharmacy_staff',
])

function canReceive(auth: MobileAuth): boolean {
  return INVENTORY_WRITE_ROLES.has(auth.role) || isMobilePharmacyAdmin(auth)
}

/**
 * Goods-received-note / stock receiving. New sellable stock enters ONLY through a real batch
 * via receivePharmacyStock — requires a genuine batch number, positive quantity and a future
 * expiry date. Accepts one or more lines (native GRN screen).
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  if (!canReceive(auth)) {
    return NextResponse.json({ error: 'Inventory write permission required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    supplierRef?: string
    lines?: Array<{
      productId: string
      batchNumber: string
      quantity: number
      expiryDate: string
      costPrice?: number
    }>
  } | null

  const lines = body?.lines ?? []
  if (lines.length === 0) {
    return NextResponse.json({ error: 'At least one line is required' }, { status: 400 })
  }

  const results: Array<{ productId: string; ok: boolean; batchId?: string; error?: string }> = []
  for (const line of lines) {
    if (!line.productId || !line.batchNumber?.trim() || !line.expiryDate || !(Number(line.quantity) > 0)) {
      results.push({
        productId: line.productId,
        ok: false,
        error: 'Missing batch number, quantity or expiry',
      })
      continue
    }

    const { data, error } = await receivePharmacyStock(db(), {
      tenantId: auth.tenantId,
      productId: line.productId,
      batchNumber: line.batchNumber,
      quantity: Math.trunc(Number(line.quantity)),
      expiryDate: line.expiryDate,
      costPrice: line.costPrice ?? null,
      receivedBy: auth.userId,
      supplierRef: body?.supplierRef ?? null,
      reason: 'Stock received (mobile GRN)',
    })

    if (error) {
      results.push({
        productId: line.productId,
        ok: false,
        error: error.humanMessage || error.message || 'Receiving failed',
      })
    } else {
      results.push({
        productId: line.productId,
        ok: true,
        batchId: data?.batchId,
      })
    }
  }

  const anyOk = results.some((r) => r.ok)
  return NextResponse.json({ ok: anyOk, results }, { status: anyOk ? 200 : 400 })
}
