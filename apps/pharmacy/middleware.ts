import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isPublicApi = pathname.startsWith('/api/public') || pathname === '/api/auth/cloud-verify'
  const isMfaPage = pathname === '/auth/2fa'
  const isOnboardingPage = pathname.startsWith('/onboarding')
  const isInvitePage = pathname.startsWith('/invite')

  // Public paths: auth pages, public API, invite links, onboarding
  const isPublicPath = isAuthPage || isPublicApi || isInvitePage || isOnboardingPage

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage && !isMfaPage) {
    return NextResponse.redirect(new URL('/portal/dashboard', request.url))
  }

  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id && !profile?.is_admin) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?error=no_pharmacy_access', request.url))
    }

    // Tenant validation: verify the tenant is active and is a pharmacy
    // Skip for platform admins (is_admin = true)
    if (!profile.is_admin && profile.tenant_id) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('is_active, facility_type')
        .eq('id', profile.tenant_id)
        .maybeSingle()

      if (!tenant || !tenant.is_active || tenant.facility_type !== 'pharmacy') {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login?error=account_inactive', request.url))
      }
    }

    const { data: userSettings } = await supabase
      .from('pharmacy_user_settings')
      .select('pharmacy_role, two_factor_enabled')
      .eq('profile_id', user.id)
      .maybeSingle()

    const roleRequiresMfa =
      userSettings?.pharmacy_role === 'pharmacy_ceo' ||
      userSettings?.pharmacy_role === 'pharmacy_admin' ||
      userSettings?.two_factor_enabled === true

    if (roleRequiresMfa) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel !== 'aal2') {
        const url = new URL('/auth/2fa', request.url)
        url.searchParams.set('next', pathname)
        return NextResponse.redirect(url)
      }
    }

    // Onboarding redirect: if not yet on onboarding/invite, check if setup is incomplete
    if (profile.tenant_id) {
      const { data: onboarding } = await supabase
        .from('pharmacy_onboarding')
        .select('current_step')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle()

      if (onboarding && onboarding.current_step < 5) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
  }

  if (user && isMfaPage) {
    const { data: userSettings } = await supabase
      .from('pharmacy_user_settings')
      .select('pharmacy_role, two_factor_enabled')
      .eq('profile_id', user.id)
      .maybeSingle()

    const roleRequiresMfa =
      userSettings?.pharmacy_role === 'pharmacy_ceo' ||
      userSettings?.pharmacy_role === 'pharmacy_admin' ||
      userSettings?.two_factor_enabled === true

    if (!roleRequiresMfa) {
      return NextResponse.redirect(new URL('/portal/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)'],
}
