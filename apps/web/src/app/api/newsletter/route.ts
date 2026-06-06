import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await (supabase as any)
    .from('newsletter_subscribers')
    .upsert(
      { email, source: 'landing_page', subscribed_at: new Date().toISOString() },
      { onConflict: 'email' }
    )

  if (error) {
    console.error('newsletter upsert error:', error.message)
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
