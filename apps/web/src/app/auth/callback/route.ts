import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '../../../lib/supabase/server'
import { signToken, createSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE, SESSION_DURATION_DAYS } from '@synapse/config/constants'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/health/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.exchangeCodeForSession(code)

    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabaseAdmin as any)
        .from('profiles')
        .select('id, email, role, tenant_id, synapse_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        const token = await signToken({
          sub: profile.id as string,
          email: (profile.email as string | null) ?? user.email ?? '',
          role: profile.role as string,
          tenant_id: (profile.tenant_id as string | null) ?? '',
          app: 'web',
          synapse_id: (profile.synapse_id as string | null) ?? undefined,
        })

        await createSession({
          userId: profile.id as string,
          token,
          app: 'web',
          ip: request.headers.get('x-forwarded-for') ?? undefined,
          userAgent: request.headers.get('user-agent') ?? undefined,
        })

        const cookieStore = await cookies()
        const expires = new Date()
        expires.setDate(expires.getDate() + SESSION_DURATION_DAYS)

        cookieStore.set(SESSION_COOKIE, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          expires,
          path: '/',
        })
      }
    }
  }

  return NextResponse.redirect(new URL(next, origin))
}
