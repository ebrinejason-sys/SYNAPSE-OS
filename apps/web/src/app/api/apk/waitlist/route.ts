import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await (supabase as any).from('apk_waitlist').upsert(
    { email: email.toLowerCase().trim(), source: 'download_page' },
    { onConflict: 'email' }
  )

  if (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
