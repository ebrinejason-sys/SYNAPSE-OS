import { NextRequest, NextResponse } from 'next/server'
import { getContext } from '@synapse/auth/context'
import { verifyFlutterwaveTransaction } from '@synapse/auth/billing/flutterwave'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/billing/verify?transaction_id=xxx&tx_ref=syn-...
 *
 * Called by the web billing client after Flutterwave redirects back.
 * Flutterwave appends ?transaction_id=<numeric>&tx_ref=<ref>&status=<status>
 * to the redirect_url.
 *
 * Flow:
 *   1. Authenticate the requesting user
 *   2. Verify the transaction with Flutterwave's API
 *   3. If successful, activate the matching subscription_payment via stored proc
 *   4. Return { ok, plan } so the client can show a success message
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

  // Step 1: Verify with Flutterwave
  const verification = await verifyFlutterwaveTransaction(transactionId)
  if (!verification.ok) {
    return NextResponse.json({ ok: false, reason: 'flutterwave_verification_failed', status: verification.status })
  }

  // Step 2: Find the pending payment record
  const db = createServiceClient() as any
  const query = txRef
    ? db.from('subscription_payments').select('id, status, plan_id').eq('provider_tx_ref', txRef).eq('tenant_id', tenantId).maybeSingle()
    : db.from('subscription_payments').select('id, status, plan_id').eq('provider_tx_id', transactionId).eq('tenant_id', tenantId).maybeSingle()

  const { data: payment, error } = await query
  if (error || !payment) {
    // Webhook may have already processed it — return ok so the user is not confused
    return NextResponse.json({ ok: true, reason: 'payment_processed_by_webhook' })
  }

  if (payment.status === 'successful') {
    return NextResponse.json({ ok: true, reason: 'already_activated' })
  }

  // Step 3: Record provider_tx_id then activate
  await db
    .from('subscription_payments')
    .update({ provider_tx_id: transactionId })
    .eq('id', payment.id)

  const { data: result, error: actErr } = await db.rpc('activate_subscription_payment', {
    p_payment_id: payment.id,
    p_actor: 'redirect_verify',
  })

  if (actErr || !result?.ok) {
    return NextResponse.json(
      { ok: false, reason: actErr?.message ?? result?.error ?? 'activation_failed' },
      { status: 500 }
    )
  }

  let planName: string | null = null
  if (payment.plan_id) {
    const { data: plan } = await db.from('subscription_plans').select('name').eq('id', payment.plan_id).maybeSingle()
    planName = plan?.name ?? null
  }

  return NextResponse.json({ ok: true, reason: 'activated', plan: planName })
}
