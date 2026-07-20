import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { generateTotpSecret, totpUri } from '@synapse/auth'
import { requirePharmacyApiSession } from "@/lib/api-auth"
export async function POST() {
  const auth = await requirePharmacyApiSession()
  if (!auth.ok) return auth.response
  const user = { id: auth.session.userId, email: auth.session.email }

  const secret = generateTotpSecret()
  const uri = totpUri(secret, user.email)

  const db = supabaseAdmin as any
  const { error } = await db
    .from('mfa_enrollments')
    .upsert({ user_id: user.id, secret, verified: false }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: 'Failed to create authenticator setup.' }, { status: 500 })
  }

  return NextResponse.json({ uri, secret })
}
