import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

type ItemStatus = 'ok' | 'low' | 'expiring' | 'expired'

function classifyProduct(quantity: number, reorderLevel: number, expiryDate: string | null): ItemStatus {
  const today = new Date()
  if (expiryDate) {
    const exp = new Date(expiryDate)
    if (exp < today) return 'expired'
    const days = (exp.getTime() - today.getTime()) / 86400000
    if (days <= 60) return 'expiring'
  }
  if (quantity <= reorderLevel) return 'low'
  return 'ok'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const tenantId = (payload.tenant_id as string) || ''
  if (!tenantId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  const { data: product } = await db()
    .from('pharmacy_products')
    .select('id, name, sku, category, quantity, reorder_level, expiry_date, batch_number, cost_price, unit_of_measure')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle()

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const quantity = Number(product.quantity) || 0
  const reorderLevel = Number(product.reorder_level) || 0

  return NextResponse.json({
    item: {
      id: product.id,
      name: product.name,
      sku: product.sku ?? null,
      category: product.category ?? null,
      quantity,
      unit: product.unit_of_measure ?? null,
      reorderLevel,
      expiryDate: product.expiry_date ?? null,
      status: classifyProduct(quantity, reorderLevel, product.expiry_date ?? null),
      batchNumber: product.batch_number ?? null,
      shelfLocation: null,
      unitCost: product.cost_price != null ? Number(product.cost_price) : null,
      currency: 'UGX',
    },
  })
}

/** Adjust quantity (set absolute) and/or reorder level. Pharmacy roles only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as {
    quantity?: number
    reorderLevel?: number
    reason?: string
  }

  const { data: product } = await db()
    .from('pharmacy_products')
    .select('id, quantity, reorder_level')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .maybeSingle()

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const previousQty = Number(product.quantity ?? 0)
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.quantity === 'number' && Number.isFinite(body.quantity)) {
    if (body.quantity < 0) {
      return NextResponse.json({ error: 'quantity must be ≥ 0' }, { status: 400 })
    }
    updates.quantity = Math.floor(body.quantity)
  }

  if (typeof body.reorderLevel === 'number' && Number.isFinite(body.reorderLevel)) {
    if (body.reorderLevel < 0) {
      return NextResponse.json({ error: 'reorderLevel must be ≥ 0' }, { status: 400 })
    }
    updates.reorder_level = Math.floor(body.reorderLevel)
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No changes' }, { status: 400 })
  }

  const { error } = await db()
    .from('pharmacy_products')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  if (typeof updates.quantity === 'number' && updates.quantity !== previousQty) {
    const delta = Number(updates.quantity) - previousQty
    await db().from('pharmacy_stock_adjustments').insert({
      tenant_id: auth.tenantId,
      product_id: id,
      quantity: delta,
      type: 'CORRECTION',
      reason: body.reason?.trim() || 'Mobile stock correction',
      previous_qty: previousQty,
      new_qty: updates.quantity,
      created_by: auth.userId,
    })
  }

  return NextResponse.json({
    ok: true,
    quantity: updates.quantity ?? previousQty,
    reorderLevel: updates.reorder_level ?? Number(product.reorder_level ?? 0),
  })
}
