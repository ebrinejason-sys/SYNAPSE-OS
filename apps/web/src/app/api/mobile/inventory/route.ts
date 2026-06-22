import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

type ItemStatus = 'ok' | 'low' | 'expiring' | 'expired'

function classifyProduct(
  quantity: number,
  reorderLevel: number,
  expiryDate: string | null
): ItemStatus {
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

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const tenantId = (payload.tenant_id as string) || ''
  if (!tenantId) {
    return NextResponse.json({
      items: [],
      summary: { totalProducts: 0, lowStock: 0, expiringSoon: 0 },
    })
  }

  const { data: products, error } = await db()
    .from('pharmacy_products')
    .select('id, name, quantity, reorder_level, expiry_date')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 })
  }

  const items = (products ?? []).map((p: Record<string, unknown>) => {
    const quantity = Number(p.quantity) || 0
    const reorderLevel = Number(p.reorder_level) || 0
    const expiryDate = (p.expiry_date as string | null) ?? null
    const status = classifyProduct(quantity, reorderLevel, expiryDate)

    return {
      id: p.id as string,
      name: p.name as string,
      quantity,
      reorderLevel,
      expiryDate,
      status,
    }
  })

  // Surface alerts first: expired → low → expiring → ok
  const priority: Record<ItemStatus, number> = { expired: 0, low: 1, expiring: 2, ok: 3 }
  items.sort((a: { status: ItemStatus }, b: { status: ItemStatus }) =>
    priority[a.status] - priority[b.status]
  )

  const summary = {
    totalProducts: items.length,
    lowStock: items.filter((i: { status: ItemStatus }) => i.status === 'low' || i.status === 'expired').length,
    expiringSoon: items.filter((i: { status: ItemStatus }) => i.status === 'expiring').length,
  }

  return NextResponse.json({ items, summary })
}
