import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { revokeSession } from '@synapse/auth'
import { SESSION_COOKIE } from '@synapse/config/constants'

export async function POST(_req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await revokeSession(token).catch(() => {})
  }

  cookieStore.delete(SESSION_COOKIE)

  // Also sign out of Supabase Auth so its cookie is cleared
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet: { name: string; value: string; options?: Record<string, unknown> }[]) =>
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, (options ?? {}) as Parameters<typeof cookieStore.set>[2])),
        },
      })
      await supabase.auth.signOut()
    } catch {}
  }

  return NextResponse.json({ ok: true })
}
