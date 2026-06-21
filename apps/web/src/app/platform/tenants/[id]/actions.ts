'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin } from '../../../../lib/platform/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { Resend } from 'resend'
import { logPlatformEvent, logSubscriptionEvent } from '../../_lib/platform-data'

export async function resendPharmacyInvite(tenantId: string): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const { data: onboarding } = await db
    .from('pharmacy_onboarding')
    .select('invite_token')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!onboarding?.invite_token) return { ok: false, error: 'No invite token found.' }

  const { data: tenant } = await db.from('tenants').select('name').eq('id', tenantId).single()
  const { data: profile } = await db
    .from('profiles')
    .select('email, full_name')
    .eq('tenant_id', tenantId)
    .eq('role', 'pharmacy_admin')
    .maybeSingle()

  if (!profile?.email) return { ok: false, error: 'Admin email not found.' }

  const newExpiry = new Date()
  newExpiry.setHours(newExpiry.getHours() + 72)
  await db.from('pharmacy_onboarding')
    .update({ invite_expires_at: newExpiry.toISOString() })
    .eq('tenant_id', tenantId)

  const baseUrl = process.env.NEXT_PUBLIC_PHARMACY_APP_URL ?? 'https://pharm.synapseos.tech'
  const inviteUrl = `${baseUrl}/invite/${onboarding.invite_token}`
  const firstName = profile.full_name?.split(' ')[0] ?? 'there'

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from:    'Synapse OS <noreply@synapseos.tech>',
    to:      profile.email,
    subject: `Reminder: Set up ${tenant?.name ?? 'your pharmacy'} on Synapse`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2>Hi ${firstName},</h2>
      <p>Here is your invite link to set up <strong>${tenant?.name ?? 'your pharmacy'}</strong>:</p>
      <a href="${inviteUrl}" style="display:inline-block;background:#F97316;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        Set Up My Account →
      </a>
      <p style="color:#999;font-size:12px;margin-top:16px;">${inviteUrl}</p>
    </div>`,
  })

  return { ok: true }
}

export async function setTenantStatus(tenantId: string, status: 'active' | 'suspended'): Promise<{ ok: boolean; error?: string }> {
  await requirePlatformAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('tenants')
    .update({ status, is_active: status === 'active' })
    .eq('id', tenantId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
