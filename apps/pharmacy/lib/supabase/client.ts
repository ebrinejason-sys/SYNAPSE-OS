import { createBrowserClient } from '@supabase/ssr'

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
}

export function createClient() {
  return createBrowserClient(
    stripBom(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''),
    stripBom(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')
  )
}
