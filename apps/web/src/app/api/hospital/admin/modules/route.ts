import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  fetchModuleRegistry,
  isContextError,
  logHospitalAudit,
  moduleToggleSchema,
  requireHospitalAdminContext,
  requireHospitalCapability,
} from '../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'module', 'read')
  if (cap) return cap

  const registry = await fetchModuleRegistry()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: toggles } = await db
    .from('hospital_modules')
    .select('module_key, is_active, activated_at')
    .eq('hospital_id', ctx.hospitalId)

  const toggleMap = new Map<string, { is_active: boolean; activated_at: string | null }>(
    (toggles ?? []).map((t: { module_key: string; is_active: boolean; activated_at: string | null }) => [
      t.module_key,
      { is_active: Boolean(t.is_active), activated_at: t.activated_at ?? null },
    ]),
  )

  const modules = registry
    .filter((m) => m.key !== 'platform')
    .map((entry) => {
      const toggle = toggleMap.get(entry.key)
      return {
        ...entry,
        is_active: entry.key === 'core' ? true : Boolean(toggle?.is_active),
        activated_at: toggle?.activated_at ?? null,
      }
    })

  return NextResponse.json({ modules })
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'module', 'write')
  if (cap) return cap

  const body = await req.json().catch(() => null)
  const parsed = moduleToggleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { module_key, is_active } = parsed.data
  if (module_key === 'core' || module_key === 'platform') {
    return NextResponse.json({ error: 'This module cannot be toggled.' }, { status: 400 })
  }

  if (is_active) {
    const registry = await fetchModuleRegistry()
    const entry = registry.find((m) => m.key === module_key)
    if (entry?.feature_key) {
      const { gateFeature } = await import('@synapse/auth/features')
      const featureBlock = await gateFeature(ctx.tenantId, entry.feature_key)
      if (featureBlock) return featureBlock
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const row = {
    hospital_id: ctx.hospitalId,
    tenant_id: ctx.tenantId,
    module_key,
    is_active,
    activated_at: is_active ? new Date().toISOString() : null,
  }

  const { data, error } = await db
    .from('hospital_modules')
    .upsert(row, { onConflict: 'hospital_id,module_key' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: is_active ? 'ENABLE' : 'DISABLE',
    tableName: 'hospital_modules',
    recordId: data.id,
    newValue: { module_key, is_active },
  })

  return NextResponse.json({ module: data })
}
