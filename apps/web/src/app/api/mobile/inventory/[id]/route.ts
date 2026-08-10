import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  summarizeInventory,
  kampalaToday,
  normaliseBatch,
} from '@synapse/db/inventory'
import {
  adjustPharmacyBatchStock,
  receivePharmacyStock,
} from '@synapse/db/inventory-rpc'
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
      'id, name, sku, barcode, category, quantity, reorder_level, expiry_date, batch_number, cost_price, price, unit_of_measure, requires_prescription, is_active',
    )
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle()

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const quantity = Number(product.quantity) || 0
  const reorderLevel = Number(product.reorder_level) || 0
  const today = kampalaToday()

  const { data: batches } = await db()
    .from('pharmacy_product_batches')
    .select('id, batch_number, quantity, expiry_date, is_active, status, cost_price, manufacturer')
    .eq('tenant_id', tenantId)
    .eq('product_id', id)
    .order('expiry_date', { ascending: true })

  const rawBatches = batches ?? []
  const summary = summarizeInventory(
    {
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      is_active: product.is_active,
    },
    rawBatches,
    today,
  )

  return NextResponse.json({
    item: {
      id: product.id,
      name: product.name,
      sku: product.sku ?? null,
      barcode: product.barcode ?? null,
      category: product.category ?? null,
      quantity,
      sellableQuantity: summary.sellableQuantity,
      physicalQuantity: summary.physicalQuantity,
      expiredQuantity: summary.expiredQuantity,
      quarantinedQuantity: summary.quarantinedQuantity,
      unbatchedQuantity: summary.unbatchedQuantity,
      hasPhantomStock: summary.hasPhantomStock,
      unit: product.unit_of_measure ?? null,
      reorderLevel,
      price: Number(product.price ?? 0),
      expiryDate: product.expiry_date ?? null,
      status: classifyProduct(
        summary.sellableQuantity,
        reorderLevel,
        product.expiry_date ?? null,
      ),
      batchNumber: product.batch_number ?? null,
      shelfLocation: null,
      unitCost: product.cost_price != null ? Number(product.cost_price) : null,
      currency: 'UGX',
      requiresPrescription: Boolean(product.requires_prescription),
      batches: rawBatches.map((b: Record<string, unknown>) => {
        const norm = normaliseBatch(b, today)
        return {
          id: b.id,
          batchNumber: b.batch_number,
          quantity: Number(b.quantity ?? 0),
          expiryDate: b.expiry_date,
          status: norm.status,
          isActive: b.is_active !== false,
          costPrice: b.cost_price != null ? Number(b.cost_price) : null,
          manufacturer: b.manufacturer ?? null,
        }
      }),
    },
  })
}

/**
 * Catalog field updates (name, sku, price, …) remain direct product updates.
 * Quantity changes require a batch: batchId for CORRECTION, or batchNumber+expiryDate
 * for receiving an INCREASE. Absolute product.quantity without batch is rejected.
 */
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
    batchId?: string | null
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

  let stockResult: Record<string, unknown> | null = null

  if (typeof body.quantity === 'number' && Number.isFinite(body.quantity)) {
    if (body.quantity < 0) {
      return NextResponse.json({ error: 'quantity must be ≥ 0' }, { status: 400 })
    }

    const targetQty = Math.floor(body.quantity)
    const batchId =
      typeof body.batchId === 'string' && body.batchId.trim() ? body.batchId.trim() : null
    const batchNumber =
      typeof body.batchNumber === 'string' && body.batchNumber.trim()
        ? body.batchNumber.trim()
        : null
    const expiryDate =
      typeof body.expiryDate === 'string' && body.expiryDate.trim()
        ? body.expiryDate.trim()
        : null
    const reason = body.reason?.trim() || 'Mobile stock correction'

    if (batchId) {
      // Absolute correction on a specific batch
      const { data, error } = await adjustPharmacyBatchStock(db(), {
        tenantId: auth.tenantId,
        productId: id,
        quantity: targetQty,
        type: 'CORRECTION',
        reason,
        actorId: auth.userId,
        batchId,
      })
      if (error) {
        return NextResponse.json(
          { error: error.humanMessage, code: error.code },
          { status: error.code === 'INSUFFICIENT_BATCH' ? 409 : 400 },
        )
      }
      stockResult = data
    } else if (batchNumber && expiryDate && targetQty > previousQty) {
      // Increase via receive — only the delta is received onto the new/existing batch
      const delta = targetQty - previousQty
      const { data, error } = await receivePharmacyStock(db(), {
        tenantId: auth.tenantId,
        productId: id,
        batchNumber,
        quantity: delta,
        expiryDate,
        costPrice:
          typeof body.costPrice === 'number' && Number.isFinite(body.costPrice)
            ? body.costPrice
            : null,
        receivedBy: auth.userId,
        reason,
      })
      if (error) {
        return NextResponse.json(
          { error: error.humanMessage, code: error.code },
          { status: 400 },
        )
      }
      stockResult = data as unknown as Record<string, unknown>
    } else if (batchNumber && expiryDate && targetQty === previousQty) {
      // No stock change — ignore
    } else {
      return NextResponse.json(
        {
          error:
            'Quantity corrections require a batch. Provide batchId for an absolute batch correction, or batchNumber and expiryDate to receive additional stock. Product-level quantity cannot be set without genuine batch information.',
          code: 'REQUIRES_BATCH',
        },
        { status: 400 },
      )
    }
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
    // Do not write batchNumber/expiryDate onto the product as sellable truth —
    // those flow through receivePharmacyStock / adjustPharmacyBatchStock only.
  }

  const catalogOnly = Object.keys(updates).length > 1
  if (!catalogOnly && !stockResult && typeof body.quantity !== 'number') {
    return NextResponse.json({ error: 'No changes' }, { status: 400 })
  }

  if (catalogOnly) {
    const { error } = await db()
      .from('pharmacy_products')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  const { data: refreshed } = await db()
    .from('pharmacy_products')
    .select('quantity, reorder_level')
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    quantity: Number(refreshed?.quantity ?? previousQty),
    reorderLevel: Number(
      refreshed?.reorder_level ?? updates.reorder_level ?? product.reorder_level ?? 0,
    ),
    stock: stockResult ?? undefined,
  })
}
