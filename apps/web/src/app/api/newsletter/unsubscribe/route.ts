import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabase/server'

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t')
  if (!t) {
    return NextResponse.redirect(new URL('/?unsubscribed=error', req.url))
  }

  let email: string
  try {
    email = Buffer.from(t, 'base64url').toString('utf-8')
    if (!email.includes('@')) throw new Error('invalid')
  } catch {
    return NextResponse.redirect(new URL('/?unsubscribed=error', req.url))
  }

  const db = createServiceClient() as any
  await db
    .from('newsletter_subscribers')
    .update({ subscribed: false, unsubscribed_at: new Date().toISOString() })
    .eq('email', email)

  return NextResponse.redirect(new URL('/unsubscribed', req.url))
}
