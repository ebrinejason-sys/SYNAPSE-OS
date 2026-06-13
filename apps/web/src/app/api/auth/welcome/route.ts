import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { sendWelcomeEmail } from '../../../../lib/resend'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const name  = profile?.full_name ?? 'there'
  const email = profile?.email     ?? user.email

  if (!email) {
    return NextResponse.json({ error: 'No email on record' }, { status: 400 })
  }

  await sendWelcomeEmail(email, name)
  return NextResponse.json({ ok: true })
}
