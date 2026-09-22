import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  mobileHasPharmacyCapability,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (
    !mobileHasPharmacyCapability(auth, 'purchasing.manage') &&
    !mobileHasPharmacyCapability(auth, 'inventory.read')
  ) {
    return NextResponse.json({ error: 'Purchasing permission required' }, { status: 403 })
  }

  const { data } = await db()
    .from('pharmacy_suppliers')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    canManage: mobileHasPharmacyCapability(auth, 'purchasing.manage'),
    suppliers: (data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone ?? null,
      address: s.address ?? null,
      contactPerson: s.contact_person ?? null,
      notes: s.notes ?? null,
      isActive: s.is_active !== false,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (!mobileHasPharmacyCapability(auth, 'purchasing.manage')) {
    return NextResponse.json({ error: 'Purchasing permission required' }, { status: 403 })
  }

  const { name, email, phone, address, contactPerson, notes, taxNumber } = (await req.json().catch(() => ({}))) as Record<string, string>
  if (!name) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })

  if (email) {
  const { data: existing } = await db()
    .from('pharmacy_suppliers')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .eq('email', email)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Supplier with this email already exists' }, { status: 400 })
  }

  const { data: supplier, error } = await db()
    .from('pharmacy_suppliers')
    .insert({
      tenant_id: auth.tenantId,
      name,
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
      contact_person: contactPerson ?? null,
      tax_number: taxNumber ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })

  await db().from('pharmacy_audit_logs').insert({
    tenant_id: auth.tenantId,
    profile_id: auth.userId,
    action: 'CREATE_SUPPLIER',
    entity: 'SUPPLIER',
    entity_id: supplier.id,
    details: `Created supplier: ${name}`,
  })

  return NextResponse.json({ ok: true, supplier })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (!mobileHasPharmacyCapability(auth, 'purchasing.manage')) {
    return NextResponse.json({ error: 'Purchasing permission required' }, { status: 403 })
  }

  const { id, name, email, phone, address, contactPerson, notes, isActive } = (await req.json().catch(() => ({}))) as Record<string, unknown>
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Supplier id required' }, { status: 400 })

  const { error } = await db()
    .from('pharmacy_suppliers')
    .update({
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      phone: phone ?? null,
      address: address ?? null,
      contact_person: contactPerson ?? null,
      notes: notes ?? null,
      ...(isActive !== undefined ? { is_active: Boolean(isActive) } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
  if (error) return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
