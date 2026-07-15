import { NextRequest, NextResponse } from 'next/server'
import { getContext } from '@synapse/auth/context'
import { confirmSubscriptionPayment } from '@synapse/auth/billing'

export const dynamic = 'force-dynamic'

/**
 * GET /api/billing/verify?transaction_id=xxx&tx_ref=SUB-...
 *
 * Called by the web billing client after Flutterwave redirects back.
 * Flutterwave appends ?transaction_id=<numeric>&tx_ref=<ref>&status=<status>
 * to the redirect_url.
 *
 * All money facts come from Flutterwave's server-to-server verify endpoint via
 * confirmSubscriptionPayment — the query params only tell us WHICH transaction
 * to verify. Amount/currency/tx_ref mismatches never activate anything.
 */
export async function GET(req: NextRequest) {
  let tenantId: string
  try {
    const ctx = await getContext('web')
    tenantId = ctx.user.tenantId
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const transactionId = searchParams.get('transaction_id')
  const txRef = searchParams.get('tx_ref')

  if (!transactionId) {
    return NextResponse.json({ ok: false, reason: 'missing_transaction_id' }, { status: 400 })
  }

  const result = await confirmSubscriptionPayment({
    transactionId,
    txRef,
    tenantId,
    actor: 'redirect_verify',
  })

  if (result.reason === 'payment_not_found') {
    // Webhook may have already processed it — return ok so the user is not confused.
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
