'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@synapse/db/admin'
import { canTransitionStage, normalizeCrmStage } from '@synapse/db/commercial-crm'
import { requirePlatformAccess } from '../../../../lib/platform/auth'

export async function updateLeadStageAction(formData: FormData) {
  const admin = await requirePlatformAccess('platform.crm.manage')
  const id = String(formData.get('id') ?? '').trim()
  const next = normalizeCrmStage(String(formData.get('stage') ?? ''))
  if (!id || !next) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: current } = await db.from('hospital_leads').select('id, stage').eq('id', id).maybeSingle()
  if (!current) return
  const from = normalizeCrmStage(current.stage) ?? 'LEAD'
  if (!canTransitionStage(from, next)) return

  await db
    .from('hospital_leads')
    .update({ stage: next, updated_at: new Date().toISOString() })
    .eq('id', id)

  await db.from('commercial_lead_activities').insert({
    lead_id: id,
    activity_type: 'stage_change',
    summary: `Stage ${from} → ${next}`,
    from_stage: from,
    to_stage: next,
    actor_id: admin.id,
  })

  await db.from('platform_audit_events').insert({
    actor_id: admin.id,
    actor_role: admin.platformRole,
    action: 'CRM_LEAD_STAGE_CHANGED',
    resource_type: 'hospital_leads',
    resource_id: id,
    metadata: { from, to: next },
    source: 'platform_crm',
  })

  revalidatePath('/platform/commercial/leads')
}
