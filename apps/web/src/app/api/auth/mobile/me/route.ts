import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { valid } = await validateSession(token)
  if (!valid) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 })
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id, email, role, tenant_id,
      full_name, first_name, last_name, is_admin, must_change_password
    `)
    .eq('id', payload.sub)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', profile.tenant_id ?? '')
    .maybeSingle()

  const joinedName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  const fullName = (profile.full_name as string | null) ?? (joinedName || null)

  return NextResponse.json({
    id: profile.id,
    email: (profile.email as string | null) ?? '',
    role: profile.role as string,
    fullName,
    tenantId: (profile.tenant_id as string | null) ?? '',
    tenantName: (tenant?.name as string | null) ?? '',
    isAdmin: (profile.is_admin as boolean | null) ?? false,
    mustChangePassword: (profile.must_change_password as boolean | null) ?? false,
  })
}
