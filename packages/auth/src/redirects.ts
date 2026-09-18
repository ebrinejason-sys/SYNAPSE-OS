import {
  CLINICAL_ROLES,
  PHARMACY_ROLES,
  type SynapseRole,
} from '@synapse/config/constants'

export type PostLoginContext = {
  role: SynapseRole | string
  mustChangePassword?: boolean
  emailVerified?: boolean
  onboardingComplete?: boolean
  pharmacyOnboardingStep?: number | null
  tenantFacilityType?: string | null
  /** Override pharmacy portal base (defaults to NEXT_PUBLIC_PHARMACY_APP_URL) */
  pharmacyAppUrl?: string
}

const DEFAULT_PHARMACY_APP =
  'https://pharm.synapseos.tech'

/**
 * Canonical post-auth landing path for web (@synapse/web) surfaces.
 * Pharmacy staff are sent to the standalone pharmacy app URL.
 */
export function getPostLoginPath(ctx: PostLoginContext): string {
  if (ctx.mustChangePassword) {
    return '/reset-password'
  }

  if (ctx.emailVerified === false) {
    return '/verify-email'
  }

  const role = String(ctx.role)

  if (role === 'platform_admin' || role === 'superadmin') {
    return '/platform'
  }

  if (ctx.tenantFacilityType === 'laboratory' || role === 'lab_admin' || role === 'lab_supervisor') {
    return '/lab/orders'
  }

  if (
    PHARMACY_ROLES.includes(ctx.role as (typeof PHARMACY_ROLES)[number]) ||
    role === 'pharmacy_admin' ||
    ctx.tenantFacilityType === 'pharmacy'
  ) {
    const base = (ctx.pharmacyAppUrl ?? DEFAULT_PHARMACY_APP).replace(/\/$/, '')
    if (ctx.pharmacyOnboardingStep != null && ctx.pharmacyOnboardingStep < 5) {
      return `${base}/onboarding`
    }
    return `${base}/portal/dashboard`
  }

  if (ctx.tenantFacilityType === 'laboratory' || ['lab_admin', 'lab_scientist', 'lab_technician'].includes(role)) {
    return '/lab/orders'
  }

  if (role === 'patient') {
    return '/health/dashboard'
  }

  if (role === 'hospital_admin') {
    return ctx.onboardingComplete === false ? '/onboarding' : '/hospital/admin'
  }

  if (CLINICAL_ROLES.includes(ctx.role as (typeof CLINICAL_ROLES)[number])) {
    if (ctx.onboardingComplete === false) return '/onboarding'
    switch (role) {
      case 'doctor':
        return '/doctor'
      case 'nurse':
        return '/nurse'
      case 'lab_scientist':
      case 'lab_admin':
        return '/lab/orders'
      case 'radiologist':
        return '/os'
      default:
        return '/doctor'
    }
  }

  if (role === 'pharmacist') {
    return '/pharmacy/queue'
  }

  if (role === 'receptionist') {
    return '/os'
  }

  return '/health/dashboard'
}

/** True when redirect target is an external pharmacy app origin. */
export function isExternalRedirect(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://')
}
