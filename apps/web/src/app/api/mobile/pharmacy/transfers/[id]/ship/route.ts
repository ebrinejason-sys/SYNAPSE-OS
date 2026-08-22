import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { logAudit } from '@synapse/db'
import { shipPharmacyStockTransfer } from '@synapse/db/inventory-rpc'
import { httpStatusForPharmacyError, pharmacyDomainError } from '@synapse/db/errors'
import {
  canWriteMobilePharmacyInventory,
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobilePharmacyAuth(request)
  if (!isMobileAuth(auth)) return auth
  if (!canWriteMobilePharmacyInventory(auth)) {
    return NextResponse.json({ error: 'Inventory write permission required' }, { status: 403 })
  }

  const { id } = await params
  const { data: transfer, error: lookupError } = await db()
    .from('pharmacy_stock_transfers')
    .select('id, status, from_store_id, to_store_id')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: 'Unable to load transfer' }, { status: 500 })
  }
  if (!transfer) {
    return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
  }

  const { data, error } = await shipPharmacyStockTransfer(db(), {
    tenantId: auth.tenantId,
    transferId: id,
    actorId: auth.userId,
  })

  if (error) {
    const body = pharmacyDomainError(error.code, error.humanMessage)
    return NextResponse.json(body, { status: httpStatusForPharmacyError(error.code) })
  }

  await logAudit({
    actor_id: auth.userId,
    action: 'SHIP_STOCK_TRANSFER',
    resource_type: 'pharmacy_stock_transfer',
    resource_id: id,
    tenant_id: auth.tenantId,
    after_state: { ...data },
    app_surface: 'mobile',
  })

  return NextResponse.json({ ok: true, ...data })
}
