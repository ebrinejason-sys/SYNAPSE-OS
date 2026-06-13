import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@synapse/auth/tokens'
import { isAccountActivated, validateSession } from '@synapse/auth'
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

    // Fetch profile + patient profile in parallel
    const db = supabaseAdmin as any
    const [{ data: profile }, { data: patientProfile }] = await Promise.all([
      db
        .from('profiles')
        .select('id, email, full_name, first_name, last_name, role, tenant_id, hospital_id, department_id, is_admin, avatar_url, verification_status, email_verified_at, is_deleted')
        .eq('id', payload.sub)
        .maybeSingle(),
      db
        .from('patient_profiles')
        .select('id, full_name, hospital_id, phone')
        .eq('id', payload.sub)
        .maybeSingle(),
    ])

    if (!profile) return NextResponse.json({ user: null }, { status: 401 })
    if (!isAccountActivated(profile)) return NextResponse.json({ user: null }, { status: 401 })

    return NextResponse.json({
      user: {
        id:        profile.id,
        email:     profile.email,
        fullName:  profile.full_name,
        firstName: profile.first_name,
        lastName:  profile.last_name,
        role:      profile.role,
        tenantId:  profile.tenant_id,
        hospitalId: profile.hospital_id,
        departmentId: profile.department_id,
        isAdmin:   profile.is_admin,
        avatarUrl: profile.avatar_url,
        patientProfile: patientProfile ? {
          id:         patientProfile.id,
          fullName:   patientProfile.full_name,
          hospitalId: patientProfile.hospital_id,
          phone:      patientProfile.phone,
        } : null,
      },
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
