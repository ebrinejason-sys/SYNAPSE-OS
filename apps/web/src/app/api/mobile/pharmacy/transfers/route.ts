import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { logAudit } from '@synapse/db'
import {
  canWriteMobilePharmacyInventory,
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/**
 * GET /api/mobile/pharmacy/transfers
 * Tenant-scoped transfer list. Cashiers may read; mutators create.
 */
export async function GET(request: NextRequest) {
  const auth = await requireMobilePharmacyAuth(request)
  if (!isMobileAuth(auth)) return auth

  const { data, error } = await db()
    .from('pharmacy_stock_transfers')
    .select('id, status, from_store_id, to_store_id, notes, created_at, requested_by, pharmacy_stock_transfer_items(id, product_id, from_batch_id, quantity)')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    if (String(error.message).toLowerCase().includes('does not exist')) {
      return NextResponse.json({ transfers: [] })
    }
    return NextResponse.json({ error: 'Unable to load transfers' }, { status: 500 })
  }

  return NextResponse.json({ transfers: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireMobilePharmacyAuth(request)
  if (!isMobileAuth(auth)) return auth
  if (!canWriteMobilePharmacyInventory(auth)) {
    return NextResponse.json({ error: 'Inventory write permission required' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const fromStoreId = String(body.fromStoreId ?? '')
  const toStoreId = String(body.toStoreId ?? '')
  const items = Array.isArray(body.items) ? body.items : []
  if (!fromStoreId || !toStoreId || fromStoreId === toStoreId) {
    return NextResponse.json(
      { error: 'fromStoreId and toStoreId must be different stores' },
      { status: 400 },
    )
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'Transfer items are required' }, { status: 400 })
  }

  const { data: stores, error: storeError } = await db()
    .from('pharmacy_stores')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .in('id', [fromStoreId, toStoreId])
  if (storeError) return NextResponse.json({ error: 'Unable to verify stores' }, { status: 500 })
  if ((stores ?? []).length !== 2) {
    return NextResponse.json({ error: 'Both stores must belong to this pharmacy' }, { status: 404 })
  }

  const { data: transfer, error } = await db()
    .from('pharmacy_stock_transfers')
    .insert({
      tenant_id: auth.tenantId,
      from_store_id: fromStoreId,
      to_store_id: toStoreId,
      status: 'draft',
      requested_by: auth.userId,
      notes: typeof body.notes === 'string' ? body.notes : null,
    })
    .select('*')
    .single()

  if (error) {
    if (String(error.message).toLowerCase().includes('does not exist')) {
      return NextResponse.json(
        { error: 'Stock transfers require the network identity migration' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Unable to create transfer' }, { status: 500 })
  }

  const rows = items.map((item: { productId?: string; fromBatchId?: string; quantity?: number }) => ({
    transfer_id: transfer.id,
    product_id: item.productId,
    from_batch_id: item.fromBatchId ?? null,
    quantity: Number(item.quantity ?? 0),
  }))
  if (rows.some((row: { product_id?: string; quantity: number }) => !row.product_id || row.quantity <= 0)) {
    await db().from('pharmacy_stock_transfers').delete().eq('id', transfer.id).eq('tenant_id', auth.tenantId)
    return NextResponse.json({ error: 'Each item needs productId and quantity > 0' }, { status: 400 })
  }

  const { error: itemError } = await db().from('pharmacy_stock_transfer_items').insert(rows)
  if (itemError) {
    await db().from('pharmacy_stock_transfers').delete().eq('id', transfer.id).eq('tenant_id', auth.tenantId)
    return NextResponse.json({ error: 'Unable to save transfer items' }, { status: 500 })
  }

  await logAudit({
    actor_id: auth.userId,
    action: 'CREATE_STOCK_TRANSFER',
    resource_type: 'pharmacy_stock_transfer',
    resource_id: transfer.id,
    tenant_id: auth.tenantId,
    app_surface: 'mobile',
  })

  return NextResponse.json({ ok: true, transfer })
}
