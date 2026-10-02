import { NextRequest, NextResponse } from 'next/server'
import { requirePharmacyAdmin } from "@/lib/api-auth"
import { initiateSubscriptionPayment, SubscriptionPlanError } from '@synapse/auth/billing'
import { pharmacyAppUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requirePharmacyAdmin()
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  try {
    const body = (await req.json()) as { planSlug?: string }
    const planSlug = body.planSlug?.trim()
    if (!planSlug) return NextResponse.json({ error: 'planSlug is required' }, { status: 400 })

    const base = pharmacyAppUrl()
    const result = await initiateSubscriptionPayment({
      tenantId: session.tenantId,
      planSlug,
      email: session.email,
      name: session.fullName ?? session.email,
      redirectUrl: `${base}/portal/billing?paid=1`,
    })

    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof SubscriptionPlanError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 })
    }
    // Never echo raw database / payment-provider errors to the client.
    console.error('[billing/subscribe] initiation failed:', e instanceof Error ? e.name : 'unknown')
    return NextResponse.json({ error: 'Payment initiation failed. Please try again.' }, { status: 500 })
  }
}
