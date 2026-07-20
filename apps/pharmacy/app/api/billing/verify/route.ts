import { NextRequest, NextResponse } from 'next/server'
import { requirePharmacyTenant } from "@/lib/api-auth"
import { confirmSubscriptionPayment } from '@synapse/auth/billing'

export const dynamic = 'force-dynamic'

/**
 * GET /api/billing/verify?transaction_id=xxx&tx_ref=SUB-...
 *
 * Called by the pharmacy billing page after Flutterwave redirects back
 * (?transaction_id=<numeric>&tx_ref=<ref>&status=<status>).
 *
 * All money facts come from Flutterwave's server-to-server verify endpoint via
 * confirmSubscriptionPayment — the query params only tell us WHICH transaction
 * to verify. Amount/currency/tx_ref mismatches never activate anything.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePharmacyTenant()
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  const { searchParams } = req.nextUrl
  const transactionId = searchParams.get('transaction_id')
  const txRef = searchParams.get('tx_ref')

  if (!transactionId) {
    return NextResponse.json({ ok: false, reason: 'missing_transaction_id' }, { status: 400 })
  }

  const result = await confirmSubscriptionPayment({
    transactionId,
    txRef,
    tenantId: session.tenantId,
    actor: 'redirect_verify',
  })

  if (result.reason === 'payment_not_found') {
    // Webhook may have already processed it under a different key — don't alarm the user.
    return NextResponse.json({ ok: true, reason: 'payment_processed_by_webhook' })
  }
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason })
  }
  return NextResponse.json({
    ok: true,
    reason: result.idempotent ? 'already_activated' : 'activated',
    plan: result.planName ?? null,
    invoice: result.invoiceNo ?? null,
  })
}
