import { supabaseAdmin } from '@synapse/db/admin'
import { initFlutterwavePayment } from './flutterwave'

export type SubscriptionStatus = {
  status: string
  planSlug: string | null
  planName: string | null
  priceUgx: number | null
  currentPeriodEnd: string | null
  graceUntil: string | null
  lastPaymentAt: string | null
  cancelAtPeriodEnd: boolean
}

export type PaymentRow = {
  id: string
  tenant_id: string
  amount_ugx: number
  status: string
  method: string | null
  provider_tx_ref: string | null
  provider_tx_id: string | null
  created_at: string
  confirmed_at: string | null
}

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any
}

export async function getSubscriptionStatus(tenantId: string): Promise<SubscriptionStatus | null> {
  const { data, error } = await db()
    .from('tenant_subscriptions')
    .select(`
      status, current_period_end, grace_until, last_payment_at, cancel_at_period_end,
      subscription_plans ( slug, name, price_ugx )
    `)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) return null

  const plan = data.subscription_plans as { slug?: string; name?: string; price_ugx?: number } | null
  return {
    status: data.status,
    planSlug: plan?.slug ?? null,
    planName: plan?.name ?? null,
    priceUgx: plan?.price_ugx ?? null,
    currentPeriodEnd: data.current_period_end,
    graceUntil: data.grace_until,
    lastPaymentAt: data.last_payment_at,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
  }
}

export async function listSubscriptionPayments(tenantId: string, limit = 20): Promise<PaymentRow[]> {
  const { data } = await db()
    .from('subscription_payments')
    .select('id, tenant_id, amount_ugx, status, method, provider_tx_ref, provider_tx_id, created_at, confirmed_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as PaymentRow[]
}

export async function listAllPayments(limit = 100): Promise<(PaymentRow & { tenant_name?: string })[]> {
  const { data } = await db()
    .from('subscription_payments')
    .select(`
      id, tenant_id, amount_ugx, status, method, provider_tx_ref, provider_tx_id, created_at, confirmed_at,
      tenants ( name )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  return ((data ?? []) as Array<PaymentRow & { tenants?: { name?: string } }>).map((row) => ({
    ...row,
    tenant_name: row.tenants?.name,
  }))
}

export type InitSubscribeInput = {
  tenantId: string
  planSlug: string
  email: string
  name: string
  phone?: string
  redirectUrl: string
}

export type InitSubscribeResult = {
  paymentId: string
  txRef: string
  paymentLink: string
  amountUgx: number
}

export async function initiateSubscriptionPayment(input: InitSubscribeInput): Promise<InitSubscribeResult> {
  const { data: plan, error: planErr } = await db()
    .from('subscription_plans')
    .select('id, slug, name, price_ugx, is_active')
    .eq('slug', input.planSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (planErr || !plan) throw new Error('Invalid or inactive plan')
  if (!plan.price_ugx || plan.price_ugx <= 0) throw new Error('Plan price not configured')

  const { data: sub } = await db()
    .from('tenant_subscriptions')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .maybeSingle()

  const txRef = `syn-${input.tenantId.slice(0, 8)}-${Date.now()}`
  const periodStart = new Date()
  const periodEnd = new Date(periodStart)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const { data: payment, error: payErr } = await db()
    .from('subscription_payments')
    .insert({
      tenant_id: input.tenantId,
      subscription_id: sub?.id ?? null,
      plan_id: plan.id,
      amount_ugx: plan.price_ugx,
      currency: 'UGX',
      provider: 'flutterwave',
      provider_tx_ref: txRef,
      status: 'pending',
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    })
    .select('id')
    .single()

  if (payErr || !payment) throw new Error(payErr?.message ?? 'Failed to create payment record')

  const fw = await initFlutterwavePayment({
    txRef,
    amountUgx: Number(plan.price_ugx),
    email: input.email,
    name: input.name,
    phone: input.phone,
    title: `Synapse — ${plan.name}`,
    description: `Monthly subscription (${plan.slug})`,
    redirectUrl: input.redirectUrl,
  })

  return {
    paymentId: payment.id,
    txRef,
    paymentLink: fw.link,
    amountUgx: Number(plan.price_ugx),
  }
}

export async function handleFlutterwaveWebhook(payload: {
  event?: string
  data?: {
    status?: string
    tx_ref?: string
    id?: number | string
    payment_type?: string
    amount?: number
  }
}): Promise<{ ok: boolean; idempotent?: boolean; error?: string }> {
  const event = payload.event
  const data = payload.data
  if (!data?.tx_ref) return { ok: false, error: 'missing_tx_ref' }

  const successful =
    event === 'charge.completed' && data.status === 'successful'

  const { data: payment, error } = await db()
    .from('subscription_payments')
    .select('id, status, provider_tx_ref')
    .eq('provider_tx_ref', data.tx_ref)
    .maybeSingle()

  if (error || !payment) return { ok: false, error: 'payment_not_found' }

  await db()
    .from('subscription_payments')
    .update({
      raw_payload: payload,
      provider_tx_id: data.id != null ? String(data.id) : null,
      method: data.payment_type ?? null,
    })
    .eq('id', payment.id)

  if (payment.status === 'successful') return { ok: true, idempotent: true }

  if (!successful) {
    await db().from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
    return { ok: true }
  }

  const { data: result, error: actErr } = await db().rpc('activate_subscription_payment', {
    p_payment_id: payment.id,
    p_actor: 'webhook',
  })

  if (actErr) return { ok: false, error: actErr.message }
  if (!result?.ok) return { ok: false, error: result?.error ?? 'activation_failed' }
  return { ok: true }
}
