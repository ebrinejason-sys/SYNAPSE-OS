import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

if (typeof window !== 'undefined') {
  throw new Error(
    '[SYNAPSE] supabaseAdmin must never be imported in browser/client code. ' +
    'Import from @synapse/db/admin in server actions and API routes only.'
  )
}

let _instance: SupabaseClient<Database> | null = null

function getInstance(): SupabaseClient<Database> {
  if (_instance) return _instance
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      '[SYNAPSE] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set to use the service-role client.'
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
