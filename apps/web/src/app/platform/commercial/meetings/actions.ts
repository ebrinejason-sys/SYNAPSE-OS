'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@synapse/db/admin'
import { isMeetingStatus } from '@synapse/db/commercial-crm'
import { requirePlatformAccess } from '../../../../lib/platform/auth'

export async function updateMeetingStatusAction(formData: FormData) {
  const admin = await requirePlatformAccess('platform.crm.manage')
  const id = String(formData.get('id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  if (!id || !isMeetingStatus(status)) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  await db
    .from('commercial_meetings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  await db.from('platform_audit_events').insert({
    actor_id: admin.id,
    actor_role: admin.platformRole,
    action: 'CRM_MEETING_STATUS_CHANGED',
    resource_type: 'commercial_meetings',
    resource_id: id,
    metadata: { status },
    source: 'platform_crm',
  })

  revalidatePath('/platform/commercial/meetings')
}
