import { NextRequest, NextResponse } from 'next/server'
import { getSubscriptionStatus, listSubscriptionPayments, listActivePharmacyPlans } from '@synapse/auth/billing'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

/** Subscription state, payment history and available plans (tenant-scoped, read-only). */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const [subscription, payments, plans] = await Promise.all([
    getSubscriptionStatus(auth.tenantId).catch(() => null),
    listSubscriptionPayments(auth.tenantId).catch(() => []),
    listActivePharmacyPlans().catch(() => []),
  ])

  return NextResponse.json({ subscription, payments, plans })
}
