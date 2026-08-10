import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, verifyPassword, validatePasswordStrength } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/** Mobile change-password — mirrors the pharmacy portal flow so provisioned pharmacies can clear
 *  `must_change_password` from the app and complete onboarding. */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { currentPassword, newPassword } = (await req.json().catch(() => ({}))) as {
    currentPassword?: string
    newPassword?: string
  }
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const strength = validatePasswordStrength(newPassword)
  if (!strength.valid) {
    return NextResponse.json({ error: strength.errors.join('. ') }, { status: 400 })
  }

  const { data: profile } = await db()
    .from('profiles')
    .select('password_hash, email')
    .eq('id', auth.userId)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (profile.password_hash) {
    const ok = await verifyPassword(currentPassword, profile.password_hash)
    if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  } else if (profile.email) {
    const { error } = await db().auth.signInWithPassword({ email: profile.email, password: currentPassword })
    if (error) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  } else {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  const newHash = await hashPassword(newPassword)
  const { error: updateError } = await db()
    .from('profiles')
    .update({ password_hash: newHash, must_change_password: false })
    .eq('id', auth.userId)
  if (updateError) {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
  try {
    await db().from('pharmacy_user_settings').update({ must_change_password: false }).eq('profile_id', auth.userId)
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ success: true })
}
