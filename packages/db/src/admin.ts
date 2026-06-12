// packages/db/src/admin.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

if (typeof window !== 'undefined') {
  throw new Error(
    '[SYNAPSE] supabaseAdmin must never be imported in browser/client code. ' +
    'Import from @synapse/db/admin in server actions and API routes only.'
  )
}

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'x-synapse-client': 'service-role' } },
  }
)
