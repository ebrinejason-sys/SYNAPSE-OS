import { describe, expect } from "vitest"

/** True when Supabase service-role integration tests can run. */
export const hasDb = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL),
)
