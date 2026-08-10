import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  isMobilePharmacyAdmin,
  requireMobilePharmacyAuth,
  type MobileAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

const PURCHASING_ROLES = new Set([
  'pharmacy_admin',
  'pharmacy_ceo',
  'pharmacist',
  'pharmacy_store_manager',
])

function canManagePurchasing(auth: MobileAuth): boolean {
  return PURCHASING_ROLES.has(auth.role) || isMobilePharmacyAdmin(auth)
}

function mapSupplier(row: Record<string, unknown>, purchaseOrderCount = 0) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    contactPerson: (row.contact_person as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    isActive: Boolean(row.is_active ?? true),
    createdAt: (row.created_at as string | null) ?? null,
    purchaseOrderCount,
  }
}

/** GET — list suppliers for the authenticated pharmacy tenant. */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  if (!canManagePurchasing(auth)) {
    return NextResponse.json({ error: 'Purchasing permission required' }, { status: 403 })
  }

  const [{ data: suppliers, error }, { data: poRows }] = await Promise.all([
    db()
      .from('pharmacy_suppliers')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false }),
    db()
      .from('pharmacy_purchase_orders')
      .select('supplier_id')
      .eq('tenant_id', auth.tenantId),
  ])

  if (error) {
    console.error('[mobile/pharmacy/suppliers GET]', error.message)
    return NextResponse.json({ error: 'Failed to load suppliers' }, { status: 500 })
  }

  const poCounts = new Map<string, number>()
  for (const row of poRows ?? []) {
    const sid = row.supplier_id as string
    if (!sid) continue
    poCounts.set(sid, (poCounts.get(sid) ?? 0) + 1)
  }

  return NextResponse.json({
    suppliers: (suppliers ?? []).map((row: Record<string, unknown>) =>
      mapSupplier(row, poCounts.get(String(row.id)) ?? 0),
    ),
  })
}

/** POST — create a supplier (camelCase body). */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  if (!canManagePurchasing(auth)) {
    return NextResponse.json({ error: 'Purchasing permission required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string
    email?: string
    phone?: string
    address?: string
    contactPerson?: string
    notes?: string
  } | null

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim() : ''

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const { data: existing } = await db()
    .from('pharmacy_suppliers')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Supplier with this email already exists' },
      { status: 400 },
    )
  }

  const { data: supplier, error } = await db()
    .from('pharmacy_suppliers')
    .insert({
      tenant_id: auth.tenantId,
      name,
      email,
      phone: body?.phone?.trim() || null,
      address: body?.address?.trim() || null,
      contact_person: body?.contactPerson?.trim() || null,
      notes: body?.notes?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[mobile/pharmacy/suppliers POST]', error.message)
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })
  }

  await db().from('pharmacy_audit_logs').insert({
    tenant_id: auth.tenantId,
    profile_id: auth.userId,
    action: 'CREATE_SUPPLIER',
    entity: 'SUPPLIER',
    entity_id: supplier.id,
    details: `Created supplier: ${name} (mobile)`,
  })

  return NextResponse.json({
    ok: true,
    supplier: mapSupplier(supplier as Record<string, unknown>, 0),
  })
}
