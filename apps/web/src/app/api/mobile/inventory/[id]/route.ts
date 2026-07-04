import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

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
