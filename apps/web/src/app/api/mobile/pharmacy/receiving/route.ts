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

/** POST — receive stock via receivePharmacyStock (batch + expiry required). */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  if (!canReceive(auth)) {
    return NextResponse.json({ error: 'Inventory write permission required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    productId?: string
    batchNumber?: string
    quantity?: number
    expiryDate?: string
    costPrice?: number
    sellingPrice?: number
    supplierId?: string
    supplierRef?: string
    purchaseOrderId?: string
    storeId?: string
    reason?: string
  } | null

  if (
    !body?.productId ||
    !body.batchNumber?.trim() ||
    !body.quantity ||
    !body.expiryDate
  ) {
    return NextResponse.json(
      {
        error:
          'productId, batchNumber, quantity, and expiryDate are required to receive stock.',
        code: 'REQUIRES_BATCH',
      },
      { status: 400 },
    )
  }

  const { data: product } = await db()
    .from('pharmacy_products')
    .select('id, name')
    .eq('id', body.productId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const { data, error } = await receivePharmacyStock(db(), {
    tenantId: auth.tenantId,
    productId: body.productId,
    batchNumber: body.batchNumber,
    quantity: Number(body.quantity),
    expiryDate: body.expiryDate,
    costPrice: body.costPrice ?? null,
    sellingPrice: body.sellingPrice ?? null,
    receivedBy: auth.userId,
    supplierId: body.supplierId ?? null,
    supplierRef: body.supplierRef ?? null,
    purchaseOrderId: body.purchaseOrderId ?? null,
    storeId: body.storeId ?? null,
    reason: body.reason ?? 'Stock received (mobile)',
  })

  if (error) {
    return NextResponse.json(
      { error: error.humanMessage, code: error.code, detail: error.message },
      { status: 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    productId: data?.productId ?? body.productId,
    batchId: data?.batchId ?? null,
    received: data?.received ?? Number(body.quantity),
    productName: product.name,
  })
}
