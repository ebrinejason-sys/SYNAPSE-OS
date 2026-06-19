import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken } from '@synapse/auth/tokens'
import {
  PHARM_MFA_SATISFIED_COOKIE,
  verifyPharmMfaSatisfiedToken,
} from '@synapse/auth/mfa'
import { SESSION_COOKIE } from '@synapse/config/constants'

type PharmacyProfile = {
  id: string
  is_admin: boolean | null
  tenant_id: string | null
}

type PharmacyUserSettings = {
  pharmacy_role: string | null
  two_factor_enabled: boolean | null
}

type TenantRow = {
  is_active: boolean | null
  facility_type: string | null
}

type OnboardingRow = {
  current_step: number | null
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
}

function serviceRoleHeaders(): Record<string, string> | null {
  const rawUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const supabaseUrl = stripBom(rawUrl).trim()
  const supabaseKey = stripBom(rawKey).trim()
  if (!supabaseUrl || !supabaseKey) return null
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function isSessionStored(token: string, userId: string): Promise<boolean> {
  const headers = serviceRoleHeaders()
  const supabaseUrl = stripBom((process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim())
  if (!headers || !supabaseUrl) return false

  try {
    const tokenHash = await sha256Hex(token)
    const sessionUrl = new URL(`${supabaseUrl}/rest/v1/synapse_sessions`)
    sessionUrl.searchParams.set('token_hash', `eq.${tokenHash}`)
    sessionUrl.searchParams.set('select', 'user_id,expires_at,revoked_at')
    sessionUrl.searchParams.set('limit', '1')

    const response = await fetch(sessionUrl, { headers, cache: 'no-store' })
    if (!response.ok) return false

    const [session] = (await response.json()) as {
      user_id?: string | null
      expires_at?: string | null
      revoked_at?: string | null
    }[]

    if (!session || session.user_id !== userId) return false
    if (session.revoked_at) return false
    if (!session.expires_at || new Date(session.expires_at) < new Date()) return false
    return true
  } catch {
    return false
  }
}

async function getSynapseUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const payload = await verifyToken(token)
    const stored = await isSessionStored(token, payload.sub)
    return stored ? payload.sub : null
  } catch {
    return null
  }
}

async function restGet<T>(table: string, filters: Record<string, string>, select: string): Promise<T | null> {
  const headers = serviceRoleHeaders()
  const supabaseUrl = stripBom((process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim())
  if (!headers || !supabaseUrl) return null

  const url = new URL(`${supabaseUrl}/rest/v1/${table}`)
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value)
  }
  url.searchParams.set('select', select)
  url.searchParams.set('limit', '1')

  try {
    const response = await fetch(url, { headers, cache: 'no-store' })
    if (!response.ok) return null
    const [row] = (await response.json()) as T[]
    return row ?? null
  } catch {
    return null
  }
}

function roleRequiresMfa(settings: PharmacyUserSettings | null): boolean {
  // Only gate on explicit opt-in, not role — role-based TOTP blocks first-time logins
  // where TOTP hasn't been set up yet (OTP already served as 2nd factor at login)
  return settings?.two_factor_enabled === true
}

async function pharmMfaSatisfied(request: NextRequest, userId: string): Promise<boolean> {
  const token = request.cookies.get(PHARM_MFA_SATISFIED_COOKIE)?.value
  if (!token) return false
  return verifyPharmMfaSatisfiedToken(token, userId)
}

async function runPharmacyAccessChecks(params: {
  request: NextRequest
  profile: PharmacyProfile
  pathname: string
  isPublicPath: boolean
  isMfaPage: boolean
}): Promise<NextResponse | null> {
  const { request, profile, pathname, isPublicPath, isMfaPage } = params

  if (!profile.tenant_id && !profile.is_admin) {
    return NextResponse.redirect(new URL('/login?error=no_pharmacy_access', request.url))
  }

  if (!profile.is_admin && profile.tenant_id) {
    const tenant = await restGet<TenantRow>(
      'tenants',
      { id: `eq.${profile.tenant_id}` },
      'is_active,facility_type'
    )

    if (!tenant || tenant.is_active === false || tenant.facility_type !== 'pharmacy') {
      return NextResponse.redirect(new URL('/login?error=account_inactive', request.url))
    }
  }

  const userSettings = await restGet<PharmacyUserSettings>(
    'pharmacy_user_settings',
    { profile_id: `eq.${profile.id}` },
    'pharmacy_role,two_factor_enabled'
  )

  const requiresMfa = roleRequiresMfa(userSettings)

  if (isMfaPage) {
    if (!requiresMfa) {
      return NextResponse.redirect(new URL('/portal/dashboard', request.url))
    }
    return null
  }

  if (!isPublicPath && requiresMfa) {
    const satisfied = await pharmMfaSatisfied(request, profile.id)
    if (!satisfied) {
      const url = new URL('/auth/2fa', request.url)
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  if (!isPublicPath && profile.tenant_id) {
    const onboarding = await restGet<OnboardingRow>(
      'pharmacy_onboarding',
      { tenant_id: `eq.${profile.tenant_id}` },
      'current_step'
    )

    if (onboarding && (onboarding.current_step ?? 0) < 5) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes must never be HTML-redirected (POST → login/onboarding → 405).
  // Route handlers enforce auth and return JSON.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const synapseUserId = await getSynapseUserId(request)
  const synapseValid = synapseUserId !== null
  const isAuthenticated = synapseValid

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isPublicApi =
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/customer/') ||
    pathname === '/api/auth/cloud-verify'
  const isMfaPage = pathname === '/auth/2fa'
  const isOnboardingPage = pathname.startsWith('/onboarding')
  const isInvitePage = pathname.startsWith('/invite')
  const isChangePasswordPage = pathname.startsWith('/change-password')

  const isPublicPath = isAuthPage || isPublicApi || isInvitePage || isOnboardingPage || isChangePasswordPage

  if (!isAuthenticated && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthenticated && isAuthPage && !isMfaPage) {
    return NextResponse.redirect(new URL('/portal/dashboard', request.url))
  }

  if (synapseValid && synapseUserId) {
    const profile = await restGet<PharmacyProfile>(
      'profiles',
      { id: `eq.${synapseUserId}` },
      'id,is_admin,tenant_id'
    )

    if (profile) {
      const redirect = await runPharmacyAccessChecks({
        request,
        profile,
        pathname,
        isPublicPath,
        isMfaPage,
      })
      if (redirect) return redirect
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)'],
}
