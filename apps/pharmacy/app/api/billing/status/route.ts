import { NextResponse } from 'next/server'
import { getPharmacySession } from '@/lib/auth'
import { getSubscriptionStatus, listSubscriptionPayments } from '@synapse/auth/billing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getPharmacySession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [subscription, payments] = await Promise.all([
    getSubscriptionStatus(session.tenantId),
    listSubscriptionPayments(session.tenantId),
  ])

  return NextResponse.json({ subscription, payments })
}
