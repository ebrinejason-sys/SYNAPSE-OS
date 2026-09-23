import { NextRequest, NextResponse } from 'next/server'
import { requirePharmacyAdmin } from "@/lib/api-auth"
import { initiateSubscriptionPayment } from '@synapse/auth/billing'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requirePharmacyAdmin()
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  try {
    const body = (await req.json()) as { planSlug?: string }
    const planSlug = body.planSlug?.trim()
    if (!planSlug) return NextResponse.json({ error: 'planSlug is required' }, { status: 400 })

    const base = process.env.NEXT_PUBLIC_PHARMACY_APP_URL ?? req.nextUrl.origin
    const result = await initiateSubscriptionPayment({
      tenantId: session.tenantId,
      planSlug,
      email: session.email,
      name: session.fullName ?? session.email,
      redirectUrl: `${base}/portal/billing?paid=1`,
    })

    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment initiation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
