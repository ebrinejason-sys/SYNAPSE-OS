import 'server-only'

import { NextResponse } from 'next/server'
import { gateFeature } from '@synapse/auth/features'
import { supabaseAdmin } from '@synapse/db/admin'

export interface ModuleRegistryEntry {
  key: string
  label: string
  default_enabled: boolean
  feature_key: string | null
}

export async function fetchModuleRegistry(): Promise<ModuleRegistryEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db
    .from('platform_billing_config')
    .select('value')
    .eq('key', 'hospital_module_registry')
    .maybeSingle()

  if (!Array.isArray(data?.value)) return []
  return data.value as ModuleRegistryEntry[]
}

export async function isHospitalModuleActive(
  hospitalId: string,
  moduleKey: string,
): Promise<boolean> {
  if (moduleKey === 'core' || moduleKey === 'platform') return true

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db
    .from('hospital_modules')
    .select('is_active')
    .eq('hospital_id', hospitalId)
    .eq('module_key', moduleKey)
    .maybeSingle()

  return Boolean(data?.is_active)
}

/** Returns 403 when tenant module toggle is off; 402 when subscription feature missing. */
export async function gateHospitalModule(
  tenantId: string,
  hospitalId: string,
  moduleKey: string,
): Promise<NextResponse | null> {
  if (moduleKey === 'core' || moduleKey === 'platform') return null

  const active = await isHospitalModuleActive(hospitalId, moduleKey)
  if (!active) {
    return NextResponse.json(
      { error: 'module_disabled', module_key: moduleKey, message: `Module '${moduleKey}' is not enabled for this hospital.` },
      { status: 403 },
    )
  }

  const registry = await fetchModuleRegistry()
  const entry = registry.find((m) => m.key === moduleKey)
  if (entry?.feature_key) {
    const featureBlock = await gateFeature(tenantId, entry.feature_key)
    if (featureBlock) return featureBlock
  }

  return null
}
