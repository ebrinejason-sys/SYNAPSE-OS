import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let instance: SupabaseClient | null = null

function getInstance(): SupabaseClient {
  if (instance) return instance

  // Use SUPABASE_URL (server-only) so Next.js never inlines it at build time.
  // NEXT_PUBLIC_* vars get baked into the bundle — a cached build would carry the old value.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      '[SYNAPSE_PHARM] SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must both be set.'
    )
  }

  instance = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return instance
}

// Next imports API route modules during build, so create the service client
// only when a request actually uses it.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance(), prop, receiver)
  },
})
