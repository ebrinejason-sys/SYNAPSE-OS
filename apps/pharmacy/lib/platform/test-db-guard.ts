/** True when Supabase service-role integration tests can run. */
const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim()
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()

export const hasDb = Boolean(supabaseUrl && serviceRoleKey)
export const hasPartialDbConfig = Boolean(supabaseUrl || serviceRoleKey) && !hasDb
