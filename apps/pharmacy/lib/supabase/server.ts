import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
}

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    stripBom(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''),
    stripBom(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — cookie writes handled by middleware
          }
        },
      },
    }
  )
}
