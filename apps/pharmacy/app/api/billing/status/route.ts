import { NextResponse } from 'next/server'
import { requirePharmacyTenant } from "@/lib/api-auth"
import { getSubscriptionStatus, listSubscriptionPayments, listActivePharmacyPlans } from '@synapse/auth/billing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requirePharmacyTenant()
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  const [subscription, payments, plans] = await Promise.all([
    getSubscriptionStatus(session.tenantId),
    listSubscriptionPayments(session.tenantId),
    listActivePharmacyPlans(),
  ])

  return NextResponse.json({ subscription, payments, plans })
}
