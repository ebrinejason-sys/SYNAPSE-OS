import { supabaseAdmin } from "@synapse/db/admin"
import { hashBridgeSecret } from "@synapse/db/lab-device-intelligence"

export type LabBridgeRow = {
  id: string
  tenant_id: string
  name?: string
  is_active: boolean
  device_id: string | null
  revoked_at?: string | null
  api_key_hash?: string | null
}

export async function lookupLabBridge(apiKey: string): Promise<LabBridgeRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const hash = hashBridgeSecret(apiKey)
  const hashed = await db
    .from("lab_instrument_bridges")
    .select("id, tenant_id, name, is_active, device_id, revoked_at, api_key_hash")
    .eq("api_key_hash", hash)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle()
  if (hashed.data) return hashed.data as LabBridgeRow
  const legacy = await db
    .from("lab_instrument_bridges")
    .select("id, tenant_id, name, is_active, device_id, revoked_at, api_key_hash")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle()
  return (legacy.data as LabBridgeRow | null) ?? null
}
