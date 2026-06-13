// packages/db/src/admin.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

if (typeof window !== 'undefined') {
  throw new Error(
    '[SYNAPSE] supabaseAdmin must never be imported in browser/client code. ' +
    'Import from @synapse/db/admin in server actions and API routes only.'
  )
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  throw new Error(
    '[SYNAPSE] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set to use the service-role client.'
  )
}

export const supabaseAdmin = createClient<Database>(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { 'x-synapse-client': 'service-role' } },
})
