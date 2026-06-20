import { NextRequest, NextResponse } from 'next/server'
import { getContext } from '@synapse/auth/context'
import { initiateSubscriptionPayment } from '@synapse/auth/billing'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getContext('web')
    if (!ctx.user.isAdmin && ctx.user.role !== 'hospital_admin' && ctx.user.role !== 'pharmacy_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await req.json()) as { planSlug?: string; redirectUrl?: string }
    const planSlug = body.planSlug?.trim()
    if (!planSlug) {
      return NextResponse.json({ error: 'planSlug is required' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const redirectUrl = body.redirectUrl ?? `${baseUrl}/billing?paid=1`

    const result = await initiateSubscriptionPayment({
      tenantId: ctx.user.tenantId,
      planSlug,
      email: ctx.user.email,
      name: ctx.user.fullName ?? ctx.user.email,
      redirectUrl,
    })

    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment initiation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
