import { NextRequest, NextResponse } from 'next/server'
import { getPharmacySession } from '@/lib/auth'
import { verifyFlutterwaveTransaction } from '@synapse/auth/billing/flutterwave'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/billing/verify?transaction_id=xxx&tx_ref=syn-...
 *
 * Called by the pharmacy billing page client after Flutterwave redirects back.
 * Flutterwave appends ?transaction_id=<numeric>&tx_ref=<ref>&status=<status>
 * to the redirect_url.
 *
 * Flow:
 *   1. Verify the transaction with Flutterwave's API
 *   2. If successful, activate the matching subscription_payment via stored proc
 *   3. Return { ok, plan } so the client can show a success message
 */
export async function GET(req: NextRequest) {
  const session = await getPharmacySession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  const db = supabaseAdmin as any
  const query = txRef
    ? db.from('subscription_payments').select('id, status, plan_id').eq('provider_tx_ref', txRef).eq('tenant_id', session.tenantId).maybeSingle()
    : db.from('subscription_payments').select('id, status, plan_id').eq('provider_tx_id', transactionId).eq('tenant_id', session.tenantId).maybeSingle()

  const { data: payment, error } = await query
  if (error || !payment) {
    // Payment record not found — webhook may have already processed it or tx_ref mismatch.
    // Return ok:true so the user isn't confused; the webhook will handle activation.
    return NextResponse.json({ ok: true, reason: 'payment_processed_by_webhook' })
  }

  if (payment.status === 'successful') {
    // Already activated (likely by webhook) — idempotent
    return NextResponse.json({ ok: true, reason: 'already_activated' })
  }

  // Step 3: Update provider_tx_id and activate via stored proc
  await db
    .from('subscription_payments')
    .update({ provider_tx_id: transactionId })
    .eq('id', payment.id)

  const { data: result, error: actErr } = await db.rpc('activate_subscription_payment', {
    p_payment_id: payment.id,
    p_actor: 'redirect_verify',
  })

  if (actErr || !result?.ok) {
    return NextResponse.json({ ok: false, reason: actErr?.message ?? result?.error ?? 'activation_failed' }, { status: 500 })
  }

  // Fetch plan name for the success message
  let planName: string | null = null
  if (payment.plan_id) {
    const { data: plan } = await db.from('subscription_plans').select('name').eq('id', payment.plan_id).maybeSingle()
    planName = plan?.name ?? null
  }

  return NextResponse.json({ ok: true, reason: 'activated', plan: planName })
}
