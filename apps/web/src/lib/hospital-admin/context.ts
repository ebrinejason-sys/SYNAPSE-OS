import 'server-only'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from '@synapse/auth/tokens'
import { isAccountActivated, validateSession, withMembershipSuspension } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE } from '@synapse/config/constants'
import type { HospitalContext } from '../hospital-shared'

export type HospitalAdminContext = HospitalContext

// Facility administrators only. Control-plane operators act on a facility through
// the platform console or audited impersonation, never via a profile tenant_id.
const ADMIN_ROLES = new Set(['hospital_admin', 'admin'])

export async function requireHospitalAdminContext(): Promise<
  HospitalAdminContext | NextResponse
> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { valid } = await validateSession(token)
  if (!valid) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, role, full_name, tenant_id, hospital_id, is_admin, verification_status, email_verified_at, is_deleted')
    .eq('id', payload.sub)
    .maybeSingle()

  // Same account-state rule as getContext: archived, suspended (incl. a SUSPENDED
  // platform membership) or unverified identities cannot use a still-valid session.
  const activated = profile
    ? await withMembershipSuspension(profile).then(isAccountActivated).catch(() => false)
    : false
  if (!activated) {
    return NextResponse.json({ error: 'Account unavailable' }, { status: 403 })
  }

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 })
  }

  const role = String(profile.role ?? payload.role ?? '')
  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('facility_type')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  const facilityType = String(tenant?.facility_type ?? '')
  if (!['hospital', 'laboratory'].includes(facilityType)) {
    return NextResponse.json({ error: 'Hospital or laboratory facility required' }, { status: 403 })
  }

  const hospitalId = profile.hospital_id ?? profile.tenant_id

  return {
    userId: profile.id,
    email: profile.email ?? payload.email ?? '',
    role,
    tenantId: profile.tenant_id,
    hospitalId,
    facilityType,
    fullName: profile.full_name ?? null,
  }
}
