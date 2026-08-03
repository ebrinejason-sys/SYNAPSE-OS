import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  isMobilePharmacyAdmin,
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
    .select(
      'id, name, sku, barcode, category, quantity, reorder_level, expiry_date, batch_number, cost_price, price, unit_of_measure, requires_prescription',
    )
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle()

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const quantity = Number(product.quantity) || 0
  const reorderLevel = Number(product.reorder_level) || 0

  const { data: batches } = await db()
    .from('pharmacy_product_batches')
    .select('id, batch_number, quantity, expiry_date, is_active')
    .eq('tenant_id', tenantId)
    .eq('product_id', id)
    .eq('is_active', true)
    .order('expiry_date', { ascending: true })

  return NextResponse.json({
    item: {
      id: product.id,
      name: product.name,
      sku: product.sku ?? null,
      barcode: product.barcode ?? null,
      category: product.category ?? null,
      quantity,
      unit: product.unit_of_measure ?? null,
      reorderLevel,
      price: Number(product.price ?? 0),
      expiryDate: product.expiry_date ?? null,
      status: classifyProduct(quantity, reorderLevel, product.expiry_date ?? null),
      batchNumber: product.batch_number ?? null,
      shelfLocation: null,
      unitCost: product.cost_price != null ? Number(product.cost_price) : null,
      currency: 'UGX',
      requiresPrescription: Boolean(product.requires_prescription),
      batches: (batches ?? []).map(
        (b: {
          id: string
          batch_number: string
          quantity: number
          expiry_date: string
        }) => ({
          id: b.id,
          batchNumber: b.batch_number,
          quantity: Number(b.quantity ?? 0),
          expiryDate: b.expiry_date,
        }),
      ),
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
    name?: string
    sku?: string
    category?: string
    unit?: string
    price?: number
    costPrice?: number
    barcode?: string | null
    batchNumber?: string | null
    expiryDate?: string | null
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
  const canEditCatalog = isMobilePharmacyAdmin(auth) ||
    ['pharmacy_store_manager', 'pharmacist'].includes(auth.role)

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

  if (canEditCatalog) {
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
    if (typeof body.sku === 'string' && body.sku.trim()) updates.sku = body.sku.trim()
    if (typeof body.category === 'string') updates.category = body.category.trim() || 'General'
    if (typeof body.unit === 'string' && body.unit.trim()) {
      updates.unit_of_measure = body.unit.trim()
    }
    if (typeof body.price === 'number' && Number.isFinite(body.price) && body.price >= 0) {
      updates.price = body.price
    }
    if (typeof body.costPrice === 'number' && Number.isFinite(body.costPrice) && body.costPrice >= 0) {
      updates.cost_price = body.costPrice
    }
    if (body.barcode !== undefined) {
      updates.barcode =
        typeof body.barcode === 'string' && body.barcode.trim() ? body.barcode.trim() : null
    }
    if (body.batchNumber !== undefined) {
      updates.batch_number =
        typeof body.batchNumber === 'string' && body.batchNumber.trim()
          ? body.batchNumber.trim()
          : null
    }
    if (body.expiryDate !== undefined) {
      updates.expiry_date =
        typeof body.expiryDate === 'string' && body.expiryDate.trim()
          ? body.expiryDate.trim()
          : null
    }
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
