import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { hashPassword } from '@synapse/auth/password'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  isMobilePharmacyAdmin,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

const ROLE_MAP: Record<string, string> = {
  ADMIN: 'pharmacy_admin',
  CEO: 'pharmacy_ceo',
  STAFF: 'pharmacy_staff',
  pharmacy_admin: 'pharmacy_admin',
  pharmacy_ceo: 'pharmacy_ceo',
  pharmacy_staff: 'pharmacy_staff',
  pharmacy_cashier: 'pharmacy_cashier',
  pharmacist: 'pharmacist',
  pharmacy_store_manager: 'pharmacy_store_manager',
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return `${out}!2`
}

/** GET — staff list for this tenant. */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { data: settings } = await db()
    .from('pharmacy_user_settings')
    .select('profile_id, username, pharmacy_role, permissions, is_active, two_factor_enabled, created_at')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })

  const rows = settings ?? []
  const profileIds = rows.map((s: any) => s.profile_id)
  const profiles = new Map<string, any>()
  if (profileIds.length) {
    const { data } = await db().from('profiles').select('id, full_name, first_name, last_name, email').in('id', profileIds)
    for (const p of data ?? []) profiles.set(String(p.id), p)
  }

  return NextResponse.json({
    canManage: isMobilePharmacyAdmin(auth),
    users: rows.map((s: any) => {
      const p = profiles.get(String(s.profile_id))
      const name =
        p?.full_name || [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.email?.split('@')[0] || ''
      return {
        id: s.profile_id,
        name,
        email: p?.email ?? '',
        username: s.username,
        role: s.pharmacy_role,
        isActive: s.is_active !== false,
        twoFactorEnabled: s.two_factor_enabled ?? false,
        createdAt: s.created_at,
      }
    }),
  })
}

/** POST — invite/create a staff user. Admin only. Returns a temp password for handover. */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (!isMobilePharmacyAdmin(auth)) return NextResponse.json({ error: 'Admin role required' }, { status: 403 })

  const { name, email, username, role } = (await req.json().catch(() => ({}))) as Record<string, string>
  if (!name || !email || !role) return NextResponse.json({ error: 'name, email and role are required' }, { status: 400 })

  const pharmacyRole = ROLE_MAP[role] ?? 'pharmacy_staff'
  const emailLc = email.toLowerCase()

  const { data: existing } = await db().from('profiles').select('id').eq('email', emailLc).maybeSingle()
  if (existing) return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })

  const tempPassword = generateTempPassword()
  const passwordHash = await hashPassword(tempPassword)
  const now = new Date().toISOString()
  const newId = randomUUID()

  const { error: profErr } = await db().from('profiles').insert({
    id: newId,
    email: emailLc,
    full_name: name,
    password_hash: passwordHash,
    role: pharmacyRole,
    tenant_id: auth.tenantId,
    verification_status: 'verified',
    email_verified_at: now,
    is_deleted: false,
    must_change_password: true,
    created_at: now,
    updated_at: now,
  })
  if (profErr) {
    console.error('[mobile/pharmacy/users] profile insert', profErr.message)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }

  const { error: setErr } = await db().from('pharmacy_user_settings').insert({
    tenant_id: auth.tenantId,
    profile_id: newId,
    username: username ? username.toLowerCase() : null,
    pharmacy_role: pharmacyRole,
    permissions: [],
    must_change_password: true,
    is_active: true,
    created_by: auth.userId,
    created_at: now,
    updated_at: now,
  })
  if (setErr) {
    await db().from('profiles').delete().eq('id', newId)
    return NextResponse.json({ error: 'Failed to create user settings' }, { status: 500 })
  }

  let emailSent = false
  try {
    const { sendWelcome } = await import('@synapse/email')
    await sendWelcome({ to: emailLc, name, product: 'Synapse Pharm' })
    emailSent = true
  } catch {
    /* email infra optional */
  }

  try {
    await db().from('pharmacy_audit_logs').insert({
      tenant_id: auth.tenantId,
      profile_id: auth.userId,
      action: 'CREATE_USER',
      entity: 'USER',
      entity_id: newId,
      details: { name, email: emailLc, role: pharmacyRole, source: 'mobile' },
    })
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({
    ok: true,
    user: { id: newId, name, email: emailLc, role: pharmacyRole },
    tempPassword,
    emailSent,
  })
}

/** PATCH — disable/reactivate, change role/name, or reset password. Admin only. */
export async function PATCH(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  if (!isMobilePharmacyAdmin(auth)) return NextResponse.json({ error: 'Admin role required' }, { status: 403 })

  const { id, name, role, isActive, resetPassword } = (await req.json().catch(() => ({}))) as Record<string, unknown>
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'User id required' }, { status: 400 })

  if (resetPassword) {
    const tempPassword = generateTempPassword()
    const newHash = await hashPassword(tempPassword)
    await db().from('profiles').update({ password_hash: newHash, must_change_password: true, updated_at: new Date().toISOString() }).eq('id', id)
    try {
      await db().from('pharmacy_user_settings').update({ must_change_password: true }).eq('tenant_id', auth.tenantId).eq('profile_id', id)
      await db().from('synapse_sessions').delete().eq('user_id', id)
    } catch {
      /* non-fatal */
    }
    return NextResponse.json({ ok: true, tempPassword })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (role) update.pharmacy_role = ROLE_MAP[String(role)] ?? String(role)
  if (isActive !== undefined) update.is_active = Boolean(isActive)
  const { error } = await db().from('pharmacy_user_settings').update(update).eq('tenant_id', auth.tenantId).eq('profile_id', id)
  if (error) return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  if (typeof name === 'string' && name) {
    await db().from('profiles').update({ full_name: name, updated_at: new Date().toISOString() }).eq('id', id)
  }
  return NextResponse.json({ ok: true })
}
