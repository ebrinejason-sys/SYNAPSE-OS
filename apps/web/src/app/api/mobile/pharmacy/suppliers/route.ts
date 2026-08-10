import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  isMobilePharmacyAdmin,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { data } = await db()
    .from('pharmacy_suppliers')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    canManage: isMobilePharmacyAdmin(auth),
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
  if (!isMobilePharmacyAdmin(auth)) return NextResponse.json({ error: 'Admin role required' }, { status: 403 })

  const { name, email, phone, address, contactPerson, notes } = (await req.json().catch(() => ({}))) as Record<string, string>
  if (!name || !email) return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })

  const { data: existing } = await db()
    .from('pharmacy_suppliers')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .eq('email', email)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'Supplier with this email already exists' }, { status: 400 })

  const { data: supplier, error } = await db()
    .from('pharmacy_suppliers')
    .insert({
      tenant_id: auth.tenantId,
      name,
      email,
      phone: phone ?? null,
      address: address ?? null,
      contact_person: contactPerson ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })

  return NextResponse.json({ ok: true, supplier })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (!isMobilePharmacyAdmin(auth)) return NextResponse.json({ error: 'Admin role required' }, { status: 403 })

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
