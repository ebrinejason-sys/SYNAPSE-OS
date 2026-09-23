import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdminApi } from '@/lib/platform/auth'
import { roleHasCapability } from '@/lib/platform/rbac'
import {
  activateManualSubscription,
  isManualPaymentMethod,
  MANUAL_PAYMENT_METHODS,
  MANUAL_PAYMENT_METHOD_LABELS,
} from '@synapse/auth/billing/manual-activation'
import { listAllCommercialPlans } from '@synapse/db/commercial-pricing'
import { supabaseAdmin } from '@synapse/db/admin'

export const dynamic = 'force-dynamic'

function canActivate(role: Parameters<typeof roleHasCapability>[0]) {
  return (
    roleHasCapability(role, 'platform.subscriptions.activate')
    || roleHasCapability(role, 'platform.subscription.manage')
  )
}

function canOverride(role: Parameters<typeof roleHasCapability>[0]) {
  return (
    roleHasCapability(role, 'platform.subscriptions.override_price')
    || role === 'SUPER_ADMIN'
  )
}

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdminApi('platform.subscription.read')
  if (!auth.ok) return auth.response

  const tenantId = new URL(req.url).searchParams.get('tenantId')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const [{ data: tenant }, { data: sub }, { data: payments }, allPlans] = await Promise.all([
    db.from('tenants').select('id, name, slug, facility_type, status, is_active').eq('id', tenantId).maybeSingle(),
    db
      .from('tenant_subscriptions')
      .select(
        `id, status, payment_status, activation_source, activated_at, starts_at, ends_at,
         current_period_start, current_period_end, renewal_date, last_payment_at,
         agreed_price_ugx, agreed_currency, agreed_billing_period, commercial_notes, contract_reference,
         subscription_plans ( id, slug, name, price_ugx, billing_period, billing_cycle, pricing_state, custom_quote )`,
      )
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    db
      .from('subscription_payments')
      .select(
        'id, amount_ugx, currency, method, provider, status, provider_tx_ref, period_start, period_end, confirmed_at, created_at, raw_payload',
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50),
    listAllCommercialPlans(supabaseAdmin as never),
  ])

  if (!tenant) return NextResponse.json({ error: 'Facility not found' }, { status: 404 })

  const plans = allPlans.filter((p) => p.isActive)

  return NextResponse.json({
    tenant,
    subscription: sub ?? null,
    payments: payments ?? [],
    plans,
    paymentMethods: MANUAL_PAYMENT_METHODS.map((value) => ({
      value,
      label: MANUAL_PAYMENT_METHOD_LABELS[value],
    })),
    capabilities: {
      canActivate: canActivate(auth.profile.platformRole),
      canOverridePrice: canOverride(auth.profile.platformRole),
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdminApi('platform.subscriptions.activate')
  const legacy = !auth.ok ? await requirePlatformAdminApi('platform.subscription.manage') : null
  const gate = auth.ok ? auth : legacy
  if (!gate || !gate.ok) {
    return auth.ok === false ? auth.response : NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!canActivate(gate.profile.platformRole)) {
    return NextResponse.json({ error: 'Insufficient permissions to activate subscriptions' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const record = body as Record<string, unknown>
  const paymentMethod = record.paymentMethod
  if (!isManualPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
  }

  const result = await activateManualSubscription({
    tenantId: String(record.tenantId ?? ''),
    planSlug: String(record.planSlug ?? ''),
    paymentMethod,
    amountPaidUgx:
      record.amountPaidUgx == null || record.amountPaidUgx === ''
        ? null
        : Number(record.amountPaidUgx),
    currency: record.currency ? String(record.currency) : 'UGX',
    paymentDate: record.paymentDate ? String(record.paymentDate) : null,
    reference: record.reference ? String(record.reference) : null,
    receivedBy: record.receivedBy ? String(record.receivedBy) : null,
    notes: record.notes ? String(record.notes) : null,
    otherDescription: record.otherDescription ? String(record.otherDescription) : null,
    complimentaryReason: record.complimentaryReason ? String(record.complimentaryReason) : null,
    effectiveStartAt: record.effectiveStartAt ? String(record.effectiveStartAt) : null,
    complimentaryEndAt: record.complimentaryEndAt ? String(record.complimentaryEndAt) : null,
    priceOverride: Boolean(record.priceOverride),
    overrideReason: record.overrideReason ? String(record.overrideReason) : null,
    idempotencyKey: String(record.idempotencyKey ?? ''),
    actorId: gate.profile.id,
    actorEmail: gate.profile.email,
    canOverridePrice: canOverride(gate.profile.platformRole),
  })

  if (!result.ok) {
    const status =
      result.code === 'OVERRIDE_FORBIDDEN' ? 403 : result.code === 'UNDERPAYMENT' ? 409 : 400
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }

  return NextResponse.json(result)
}
