import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@synapse/auth/tokens'
import { validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE } from '@synapse/config/constants'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (!token) return NextResponse.json({ user: null }, { status: 401 })

  try {
    const payload = await verifyToken(token)
    const { valid } = await validateSession(token)
    if (!valid) return NextResponse.json({ user: null }, { status: 401 })

    // Fetch fresh profile data
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, first_name, last_name, role, tenant_id, is_admin, avatar_url')
      .eq('id', payload.sub)
      .single()

    if (!profile) return NextResponse.json({ user: null }, { status: 401 })

    return NextResponse.json({
      user: {
        id:        profile.id,
        email:     profile.email,
        fullName:  profile.full_name,
        firstName: profile.first_name,
        lastName:  profile.last_name,
        role:      profile.role,
        tenantId:  profile.tenant_id,
        isAdmin:   profile.is_admin,
        avatarUrl: profile.avatar_url,
      },
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
