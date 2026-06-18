// apps/pharmacy/lib/tenant.ts
// Server-side only. Provides getPharmacyContext() for server components + server actions.

import { getPharmacySession, type PharmacySession } from './auth'
import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'

export interface PharmacyTenant {
  id: string
  name: string
  slug: string
  default_subdomain: string | null
  custom_domain: string | null
  status: string
  is_active: boolean
  plan: string | null
  tier: string | null
  is_network_member: boolean
  accepts_refill_requests: boolean
  modules_enabled: string[]
  logo_url: string | null
  district: string | null
  address: string | null
  phone: string | null
  email: string | null
  onboarding_completed: boolean
  onboarding_step: number
  lat: number | null
  lng: number | null
}

// Full context: session + pharmacy tenant row
export interface PharmacyContext {
  session: PharmacySession
  tenant: PharmacyTenant
}

export async function getPharmacyContext(): Promise<PharmacyContext> {
  const session = await getPharmacySession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  // Query the tenants row - must be pharmacy type and active (unless platform_admin)
  const { data: tenantRow, error } = await supabase
    .from('tenants')
    .select(
      'id, name, slug, default_subdomain, custom_domain, status, is_active, plan, tier, is_network_member, accepts_refill_requests, modules_enabled, logo_url, district, address, phone, email, onboarding_completed, onboarding_step, lat, lng'
    )
    .eq('id', session.tenantId)
    .single()

  if (error || !tenantRow) redirect('/login?error=no_pharmacy')

  const tenant = tenantRow

  // Non-platform-admin users must belong to an active pharmacy
  const isAdmin = session.isAdmin
  const role = session.role
  if (!isAdmin && role !== 'platform_admin') {
    if (tenant.status === 'churned' || tenant.is_active === false) {
      redirect('/login?error=account_inactive')
    }
  }

  // Fetch onboarding step separately (from pharmacy_onboarding table)
  const { data: onboarding } = await supabase
    .from('pharmacy_onboarding')
    .select('current_step')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  return {
    session,
    tenant: {
      ...tenant,
      is_active: tenant.is_active ?? true,
      is_network_member: tenant.is_network_member ?? false,
      accepts_refill_requests: tenant.accepts_refill_requests ?? false,
      modules_enabled: tenant.modules_enabled ?? [],
      onboarding_step: onboarding?.current_step ?? tenant.onboarding_step ?? 0,
    } as PharmacyTenant,
  }
}

// Safe version for server actions - returns null instead of redirecting
export async function getPharmacyContextSafe(): Promise<PharmacyContext | null> {
  try {
    return await getPharmacyContext()
  } catch {
    return null
  }
}
