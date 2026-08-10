import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/**
 * GET — staff list for the tenant.
 * Read-only for all pharmacy roles (including non-admin); listing is allowed for ops awareness.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { data: userSettings, error: settingsError } = await db()
    .from('pharmacy_user_settings')
    .select(
      'profile_id, username, pharmacy_role, permissions, is_active, two_factor_enabled, created_at',
    )
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })

  if (settingsError) {
    console.error('[mobile/pharmacy/users GET]', settingsError.message)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }

  if (!userSettings?.length) {
    return NextResponse.json({ users: [] })
  }

  const profileIds = userSettings.map((s: { profile_id: string }) => s.profile_id)
  const { data: profiles } = await db()
    .from('profiles')
    .select('id, full_name, first_name, last_name, email')
    .in('id', profileIds)

  const profileMap = new Map(
    (profiles ?? []).map((p: Record<string, unknown>) => [String(p.id), p]),
  )

  const users = userSettings.map((setting: Record<string, unknown>) => {
    const profile = profileMap.get(String(setting.profile_id)) as
      | Record<string, unknown>
      | undefined
    const name =
      (profile?.full_name as string) ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      String(profile?.email ?? '').split('@')[0] ||
      ''
    return {
      id: setting.profile_id,
      name,
      email: (profile?.email as string) ?? '',
      username: setting.username ?? null,
      role: setting.pharmacy_role ?? null,
      isActive: Boolean(setting.is_active ?? true),
      createdAt: setting.created_at ?? null,
    }
  })

  return NextResponse.json({ users })
}
