import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

if (typeof window !== 'undefined') {
  throw new Error(
    '[SYNAPSE] supabaseAdmin must never be imported in browser/client code. ' +
    'Import from @synapse/db/admin in server actions and API routes only.'
  )
}

let _instance: SupabaseClient<Database> | null = null

function stripBom(str: string): string {
  // U+FEFF BOM can appear when env vars are copy-pasted in Vercel dashboard
  return str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str
}

function getInstance(): SupabaseClient<Database> {
  if (_instance) return _instance
  const rawUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const url = stripBom(rawUrl).trim()
  const key = stripBom(rawKey).trim()
  if (!url || !key) {
    throw new Error(
      '[SYNAPSE] SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must both be set to use the service-role client.'
    )
  }
  _instance = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-synapse-client': 'service-role' } },
  })
  return _instance
}

// Lazy proxy — safe to import at module level during build.
// The real client is only created on first property access (i.e. first actual request).
export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance(), prop, receiver)
  },
})
