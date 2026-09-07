import 'server-only'

import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from '@synapse/auth/tokens'
import { validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE } from '@synapse/config/constants'
import type { HospitalContext } from '../hospital-shared'

export async function requireHospitalStaffContext(options: { allowLaboratory?: boolean } = {}): Promise<
  HospitalContext | NextResponse
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
    .select('id, email, role, full_name, tenant_id, hospital_id')
    .eq('id', payload.sub)
    .maybeSingle()

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 })
  }

  const { data: tenant } = await db
    .from('tenants')
    .select('facility_type,is_active,status')
    .eq('id', profile.tenant_id)
    .maybeSingle()

  const trustedTenantId = (await headers()).get('x-tenant-id')
  if (!tenant || tenant.is_active !== true || tenant.status !== 'active' || (trustedTenantId && trustedTenantId !== profile.tenant_id)) {
    return NextResponse.json({ error: 'Facility unavailable' }, { status: 403 })
  }
  const facilityType = String(tenant.facility_type)
  const role = String(profile.role ?? payload.role ?? '')
  if (facilityType !== 'hospital' && !(options.allowLaboratory && facilityType === 'laboratory') && role !== 'platform_admin') {
    return NextResponse.json({ error: 'Hospital facility required' }, { status: 403 })
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
