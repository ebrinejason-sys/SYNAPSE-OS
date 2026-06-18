'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import { sendUserPasswordReset } from '@/lib/auth/password-reset.server'
import { logPlatformEvent } from '../_lib/platform-data'
import { supabaseAdmin } from '@synapse/db/admin'

export async function sendPasswordResetForUser(formData: FormData) {
  const admin = await requirePlatformAdmin()
  const userId = String(formData.get('user_id') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()

  if (!userId || !email) {
    return { ok: false as const, error: 'User id and email are required.' }
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name, first_name, role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.id || profile.email?.toLowerCase() !== email) {
    return { ok: false as const, error: 'User not found.' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synapseos.tech'
  const name =
    (profile.full_name as string | null) ??
    (profile.first_name as string | null) ??
    'there'

  const result = await sendUserPasswordReset({
    userId: profile.id as string,
    email,
    name,
    appUrl,
    activateIfPending: true,
  })

  if (!result.ok) {
    return { ok: false as const, error: result.error }
  }

  await logPlatformEvent({
    actorId: admin.id,
    action: 'user.password_reset_sent',
    entityType: 'profile',
    entityId: userId,
    metadata: { email, role: profile.role },
  })

  revalidatePath('/platform/users')
  return { ok: true as const, email: result.email }
}
