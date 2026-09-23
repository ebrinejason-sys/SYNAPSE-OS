/**
 * Platform Admin manual / offline subscription activation.
 * Converges with online Flutterwave flow via subscription_payments +
 * activate_subscription_payment RPC — no parallel cash-only subscription model.
 */

import { supabaseAdmin } from '@synapse/db/admin'
import { snapshotSubscriptionTerms, type CommercialPlan } from '@synapse/db/commercial-pricing'
import {
  addBillingCycle,
  kampalaStamp,
  recordSubscriptionInvoice,
  type BillingCycle,
} from './subscription'

export const MANUAL_PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'BANK_DEPOSIT',
  'MOBILE_MONEY_MANUAL',
  'CHEQUE',
  'POS_CARD',
  'COMPLIMENTARY',
  'OTHER',
] as const

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number]

export const MANUAL_PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  BANK_DEPOSIT: 'Bank deposit',
  MOBILE_MONEY_MANUAL: 'Mobile Money (manual)',
  CHEQUE: 'Cheque',
  POS_CARD: 'POS / card terminal',
  COMPLIMENTARY: 'Complimentary / pilot',
  OTHER: 'Other approved offline payment',
}

export type ActivationSource =
  | 'MANUAL_ADMIN'
  | 'OFFLINE_PAYMENT'
  | 'COMPLIMENTARY'

export type ManualActivationInput = {
  tenantId: string
  planSlug: string
  paymentMethod: ManualPaymentMethod
  /** Amount actually received (UGX). Required except COMPLIMENTARY. */
  amountPaidUgx: number | null
  currency?: string
  paymentDate?: string | null
  reference?: string | null
  receivedBy?: string | null
  notes?: string | null
  otherDescription?: string | null
  complimentaryReason?: string | null
  /** Optional override of effective start (ISO). */
  effectiveStartAt?: string | null
  /** Explicit end for complimentary only; otherwise computed. */
  complimentaryEndAt?: string | null
  /** When amount differs from canonical plan price. */
  priceOverride?: boolean
  overrideReason?: string | null
  /** Client-provided idempotency key (required). */
  idempotencyKey: string
  actorId: string
  actorEmail: string
  /** Capability: platform.subscriptions.override_price */
  canOverridePrice: boolean
}

export type ManualActivationResult =
  | {
      ok: true
      idempotent?: boolean
      paymentId: string
      subscriptionId: string
      invoiceNo: string | null
      periodStart: string
      periodEnd: string
      activationSource: ActivationSource
      paymentStatus: string
      canonicalPriceUgx: number | null
      amountPaidUgx: number
      varianceUgx: number
    }
  | { ok: false; error: string; code: string }

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any
}

export function isManualPaymentMethod(value: unknown): value is ManualPaymentMethod {
  return typeof value === 'string' && (MANUAL_PAYMENT_METHODS as readonly string[]).includes(value)
}

/** Map commercial billing_period / billing_cycle onto addBillingCycle months. */
export function resolveBillingCycleForPlan(plan: {
  billingPeriod?: string | null
  billingCycle?: string | null
}): BillingCycle | string {
  const period = (plan.billingPeriod || plan.billingCycle || 'annual').toLowerCase()
  if (period === 'annual' || period === 'yearly' || period === 'year') return 'yearly'
  if (period === 'quarterly' || period === 'quarter') return 'quarterly'
  if (period === 'monthly' || period === 'month') return 'monthly'
  return 'yearly'
}

/**
 * Early-renewal / activation period window.
 * Active paid time is never discarded: renewals extend from existing period end.
 */
export function computeSubscriptionPeriod(input: {
  now: Date
  existingStatus: string | null | undefined
  existingPeriodEnd: string | null | undefined
  billingCycle: string | null | undefined
  effectiveStartAt?: Date | null
}): { periodStart: Date; periodEnd: Date; extendedExisting: boolean } {
  const existingEnd = input.existingPeriodEnd ? new Date(input.existingPeriodEnd) : null
  const validExisting =
    existingEnd != null && !Number.isNaN(existingEnd.getTime()) && existingEnd > input.now
  const extendsExisting =
    (input.existingStatus === 'active' || input.existingStatus === 'trialing') && validExisting

  if (extendsExisting && existingEnd) {
    return {
      periodStart: existingEnd,
      periodEnd: addBillingCycle(existingEnd, input.billingCycle),
      extendedExisting: true,
    }
  }

  const start = input.effectiveStartAt && !Number.isNaN(input.effectiveStartAt.getTime())
    ? input.effectiveStartAt
    : input.now
  return {
    periodStart: start,
    periodEnd: addBillingCycle(start, input.billingCycle),
    extendedExisting: false,
  }
}

export function validateManualActivationAmounts(input: {
  method: ManualPaymentMethod
  canonicalPriceUgx: number | null
  customQuote: boolean
  amountPaidUgx: number | null
  priceOverride: boolean
  canOverridePrice: boolean
  overrideReason?: string | null
  otherDescription?: string | null
  complimentaryReason?: string | null
}): { ok: true; amountPaidUgx: number; varianceUgx: number; paymentStatus: string } | { ok: false; code: string; error: string } {
  if (input.method === 'OTHER' && !String(input.otherDescription ?? '').trim()) {
    return { ok: false, code: 'OTHER_DESCRIPTION_REQUIRED', error: 'Describe OTHER payment method' }
  }
  if (input.method === 'COMPLIMENTARY') {
    if (!String(input.complimentaryReason ?? '').trim()) {
      return { ok: false, code: 'COMPLIMENTARY_REASON_REQUIRED', error: 'Complimentary activations require a reason' }
    }
    return { ok: true, amountPaidUgx: 0, varianceUgx: 0, paymentStatus: 'waived' }
  }

  const amount = Number(input.amountPaidUgx)
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, code: 'AMOUNT_REQUIRED', error: 'Amount paid is required' }
  }

  if (input.customQuote) {
    if (amount <= 0) {
      return { ok: false, code: 'CUSTOM_AMOUNT_REQUIRED', error: 'Custom quote requires an agreed amount greater than zero' }
    }
    return { ok: true, amountPaidUgx: amount, varianceUgx: 0, paymentStatus: 'paid' }
  }

  const canonical = input.canonicalPriceUgx
  if (canonical == null || !Number.isFinite(Number(canonical)) || Number(canonical) <= 0) {
    return { ok: false, code: 'PLAN_PRICE_MISSING', error: 'Selected plan has no canonical public price' }
  }

  const expected = Number(canonical)
  const variance = amount - expected

  if (amount < expected) {
    if (!input.priceOverride) {
      return {
        ok: false,
        code: 'UNDERPAYMENT',
        error: `Amount ${amount} is below canonical price ${expected}. Use authorized price override for discounts/partial arrangements.`,
      }
    }
    if (!input.canOverridePrice) {
      return { ok: false, code: 'OVERRIDE_FORBIDDEN', error: 'Price override capability required' }
    }
    if (!String(input.overrideReason ?? '').trim()) {
      return { ok: false, code: 'OVERRIDE_REASON_REQUIRED', error: 'Override reason is required for underpayment' }
    }
    // Partial without marking PAID/ACTIVE is handled by caller when variance is large;
    // underpayment with override still activates but records variance.
    return { ok: true, amountPaidUgx: amount, varianceUgx: variance, paymentStatus: 'paid' }
  }

  if (amount > expected) {
    if (!input.priceOverride) {
      return {
        ok: false,
        code: 'OVERPAYMENT',
        error: `Amount ${amount} exceeds canonical price ${expected}. Confirm with price override if intentional.`,
      }
    }
    if (!input.canOverridePrice) {
      return { ok: false, code: 'OVERRIDE_FORBIDDEN', error: 'Price override capability required' }
    }
    if (!String(input.overrideReason ?? '').trim()) {
      return { ok: false, code: 'OVERRIDE_REASON_REQUIRED', error: 'Override reason is required for overpayment' }
    }
  }

  return { ok: true, amountPaidUgx: amount, varianceUgx: variance, paymentStatus: 'paid' }
}

function mapPlanRow(row: Record<string, unknown>): CommercialPlan {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name ?? row.slug),
    facilityType: String(row.facility_type ?? ''),
    priceUgx: row.price_ugx != null ? Number(row.price_ugx) : null,
    currency: String(row.currency ?? 'UGX'),
    billingPeriod: String(row.billing_period ?? row.billing_cycle ?? 'annual'),
    billingCycle: String(row.billing_cycle ?? 'yearly'),
    pricingState: String(row.pricing_state ?? 'PUBLIC_FIXED') as CommercialPlan['pricingState'],
    description: (row.description as string | null) ?? null,
    standaloneAvailable: row.standalone_available !== false,
    addonAvailable: Boolean(row.addon_available),
    parentPlanSlugs: Array.isArray(row.parent_plan_slugs) ? (row.parent_plan_slugs as string[]) : [],
    publicVisible: row.public_visible !== false,
    isActive: row.is_active !== false,
    displayOrder: Number(row.display_order ?? 100),
    featureList: Array.isArray(row.feature_list) ? (row.feature_list as string[]) : [],
    highlightedFeatures: Array.isArray(row.highlighted_features)
      ? (row.highlighted_features as string[])
      : [],
    ctaLabel: (row.cta_label as string | null) ?? null,
    ctaHref: (row.cta_href as string | null) ?? null,
    customQuote: Boolean(row.custom_quote) || String(row.pricing_state) === 'CUSTOM_QUOTE',
    previousPriceUgx: row.previous_price_ugx != null ? Number(row.previous_price_ugx) : null,
    version: Number(row.version ?? 1),
  }
}

export async function activateManualSubscription(
  input: ManualActivationInput,
): Promise<ManualActivationResult> {
  const key = String(input.idempotencyKey ?? '').trim()
  if (!key || key.length < 8) {
    return { ok: false, code: 'IDEMPOTENCY_REQUIRED', error: 'Idempotency key is required' }
  }
  if (!isManualPaymentMethod(input.paymentMethod)) {
    return { ok: false, code: 'INVALID_METHOD', error: 'Unsupported payment method' }
  }

  const txRef = `MANUAL-${input.tenantId}-${key}`.slice(0, 120)

  // Idempotent replay: same key already succeeded.
  const { data: existingPay } = await db()
    .from('subscription_payments')
    .select('id, status, amount_ugx, period_start, period_end, subscription_id')
    .eq('provider_tx_ref', txRef)
    .maybeSingle()

  if (existingPay?.status === 'successful') {
    const { data: sub } = await db()
      .from('tenant_subscriptions')
      .select('id, activation_source, payment_status, agreed_price_ugx')
      .eq('tenant_id', input.tenantId)
      .maybeSingle()
    return {
      ok: true,
      idempotent: true,
      paymentId: existingPay.id,
      subscriptionId: sub?.id ?? existingPay.subscription_id ?? '',
      invoiceNo: null,
      periodStart: existingPay.period_start,
      periodEnd: existingPay.period_end,
      activationSource: (sub?.activation_source as ActivationSource) ?? 'OFFLINE_PAYMENT',
      paymentStatus: sub?.payment_status ?? 'paid',
      canonicalPriceUgx: sub?.agreed_price_ugx != null ? Number(sub.agreed_price_ugx) : null,
      amountPaidUgx: Number(existingPay.amount_ugx),
      varianceUgx: 0,
    }
  }

  const { data: planRow, error: planErr } = await db()
    .from('subscription_plans')
    .select(
      'id, slug, name, facility_type, price_ugx, currency, billing_period, billing_cycle, pricing_state, description, standalone_available, addon_available, parent_plan_slugs, public_visible, is_active, display_order, feature_list, highlighted_features, cta_label, cta_href, custom_quote, previous_price_ugx, version',
    )
    .eq('slug', input.planSlug)
    .eq('is_active', true)
    .maybeSingle()

  if (planErr || !planRow) {
    return { ok: false, code: 'PLAN_NOT_FOUND', error: 'Invalid or inactive plan' }
  }
  const plan = mapPlanRow(planRow as Record<string, unknown>)

  const amountCheck = validateManualActivationAmounts({
    method: input.paymentMethod,
    canonicalPriceUgx: plan.priceUgx,
    customQuote: plan.customQuote,
    amountPaidUgx: input.amountPaidUgx,
    priceOverride: Boolean(input.priceOverride),
    canOverridePrice: input.canOverridePrice,
    overrideReason: input.overrideReason,
    otherDescription: input.otherDescription,
    complimentaryReason: input.complimentaryReason,
  })
  if (!amountCheck.ok) return amountCheck

  const { data: tenant } = await db()
    .from('tenants')
    .select('id, name, facility_type, organization_id')
    .eq('id', input.tenantId)
    .maybeSingle()
  if (!tenant) return { ok: false, code: 'TENANT_NOT_FOUND', error: 'Facility not found' }

  const { data: subBefore } = await db()
    .from('tenant_subscriptions')
    .select('id, status, current_period_end, payment_status, plan_id')
    .eq('tenant_id', input.tenantId)
    .maybeSingle()

  const now = new Date()
  const cycle = resolveBillingCycleForPlan({
    billingPeriod: plan.billingPeriod,
    billingCycle: plan.billingCycle,
  })

  let periodStart: Date
  let periodEnd: Date
  let extendedExisting = false

  if (input.paymentMethod === 'COMPLIMENTARY' && input.complimentaryEndAt) {
    const start = input.effectiveStartAt ? new Date(input.effectiveStartAt) : now
    const end = new Date(input.complimentaryEndAt)
    if (Number.isNaN(end.getTime()) || end <= start) {
      return { ok: false, code: 'INVALID_COMPLIMENTARY_WINDOW', error: 'Complimentary end must be after start' }
    }
    periodStart = start
    periodEnd = end
  } else {
    const window = computeSubscriptionPeriod({
      now,
      existingStatus: subBefore?.status,
      existingPeriodEnd: subBefore?.current_period_end,
      billingCycle: cycle,
      effectiveStartAt: input.effectiveStartAt ? new Date(input.effectiveStartAt) : null,
    })
    periodStart = window.periodStart
    periodEnd = window.periodEnd
    extendedExisting = window.extendedExisting
  }

  const activationSource: ActivationSource =
    input.paymentMethod === 'COMPLIMENTARY'
      ? 'COMPLIMENTARY'
      : 'OFFLINE_PAYMENT'

  const negotiated =
    plan.customQuote || (input.priceOverride && amountCheck.amountPaidUgx !== Number(plan.priceUgx ?? 0))
      ? amountCheck.amountPaidUgx
      : null

  const snapshot = snapshotSubscriptionTerms({
    plan,
    customNegotiatedUgx: negotiated,
    discountUgx:
      negotiated == null && plan.priceUgx != null && amountCheck.amountPaidUgx < plan.priceUgx
        ? plan.priceUgx - amountCheck.amountPaidUgx
        : 0,
  })

  const rawPayload = {
    activation_source: activationSource,
    payment_method: input.paymentMethod,
    payment_date: input.paymentDate ?? now.toISOString().slice(0, 10),
    reference: input.reference ?? null,
    received_by: input.receivedBy ?? input.actorEmail,
    notes: input.notes ?? null,
    other_description: input.otherDescription ?? null,
    complimentary_reason: input.complimentaryReason ?? null,
    canonical_price_ugx: plan.priceUgx,
    amount_paid_ugx: amountCheck.amountPaidUgx,
    variance_ugx: amountCheck.varianceUgx,
    price_override: Boolean(input.priceOverride),
    override_reason: input.overrideReason ?? null,
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    extended_existing: extendedExisting,
    previous_status: subBefore?.status ?? null,
    previous_period_end: subBefore?.current_period_end ?? null,
  }

  const { data: payment, error: payErr } = await db()
    .from('subscription_payments')
    .insert({
      tenant_id: input.tenantId,
      subscription_id: subBefore?.id ?? null,
      plan_id: plan.id,
      amount_ugx: amountCheck.amountPaidUgx,
      currency: (input.currency || plan.currency || 'UGX').toUpperCase(),
      method: input.paymentMethod.toLowerCase(),
      provider: 'manual',
      provider_tx_ref: txRef,
      status: 'pending',
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      raw_payload: rawPayload,
    })
    .select('id, amount_ugx, period_start, period_end, plan_id, tenant_id, status, provider_tx_ref, raw_payload')
    .maybeSingle()

  if (payErr) {
    if (payErr.code === '23505') {
      // Concurrent duplicate key — re-read and treat as idempotent path
      return activateManualSubscription(input)
    }
    return { ok: false, code: 'PAYMENT_INSERT_FAILED', error: payErr.message }
  }
  if (!payment) return { ok: false, code: 'PAYMENT_INSERT_FAILED', error: 'Payment insert returned no row' }

  const { data: actResult, error: actErr } = await db().rpc('activate_subscription_payment', {
    p_payment_id: payment.id,
    p_actor: input.actorEmail,
  })

  if (actErr || !actResult?.ok) {
    await db()
      .from('subscription_payments')
      .update({ status: 'failed', raw_payload: { ...rawPayload, activation_error: actErr?.message ?? actResult?.error } })
      .eq('id', payment.id)
      .eq('status', 'pending')
    return {
      ok: false,
      code: 'ACTIVATION_FAILED',
      error: actErr?.message ?? actResult?.error ?? 'Subscription activation failed — payment not marked successful',
    }
  }

  const { data: subAfter, error: snapErr } = await db()
    .from('tenant_subscriptions')
    .update({
      payment_status: amountCheck.paymentStatus,
      activation_source: activationSource,
      activated_by: input.actorId,
      activated_at: now.toISOString(),
      agreed_price_ugx: snapshot.agreedPriceUgx,
      agreed_currency: snapshot.agreedCurrency,
      agreed_billing_period: snapshot.agreedBillingPeriod,
      addon_slugs: snapshot.addonSlugs,
      addon_total_ugx: snapshot.addonTotalUgx,
      discount_ugx: snapshot.discountUgx,
      custom_negotiated_ugx: snapshot.customNegotiatedUgx,
      commercial_notes: [
        input.notes,
        input.complimentaryReason ? `Complimentary: ${input.complimentaryReason}` : null,
        input.overrideReason ? `Override: ${input.overrideReason}` : null,
        input.otherDescription ? `Other method: ${input.otherDescription}` : null,
      ]
        .filter(Boolean)
        .join('\n') || null,
      contract_reference: input.reference ?? null,
      renewal_date: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('tenant_id', input.tenantId)
    .select('id')
    .maybeSingle()

  if (snapErr || !subAfter?.id) {
    return {
      ok: false,
      code: 'SNAPSHOT_FAILED',
      error:
        snapErr?.message ??
        'Payment activated but commercial snapshot failed — reconcile subscription row',
    }
  }

  // Audit (best-effort after successful money+entitlement path)
  try {
    await db().from('platform_audit_events').insert({
      actor_id: input.actorId,
      action:
        input.paymentMethod === 'COMPLIMENTARY'
          ? 'SUBSCRIPTION_COMPLIMENTARY_ACTIVATION'
          : extendedExisting
            ? 'SUBSCRIPTION_RENEWED'
            : 'SUBSCRIPTION_MANUALLY_ACTIVATED',
      resource_type: 'tenant_subscriptions',
      resource_id: subAfter.id,
      tenant_id: input.tenantId,
      metadata: {
        ...rawPayload,
        plan_slug: plan.slug,
        payment_id: payment.id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        event: input.priceOverride ? 'SUBSCRIPTION_PRICE_OVERRIDDEN' : undefined,
      },
    })
  } catch {
    /* audit must not undo activation */
  }

  try {
    await db().from('subscription_events').insert({
      tenant_id: input.tenantId,
      from_status: subBefore?.status ?? null,
      to_status: 'active',
      reason: activationSource,
      actor: input.actorEmail,
      metadata: { payment_id: payment.id, method: input.paymentMethod, tx_ref: txRef },
    })
  } catch {
    /* optional */
  }

  let invoiceNo: string | null = null
  try {
    invoiceNo = await recordSubscriptionInvoice({
      id: payment.id,
      tenant_id: input.tenantId,
      plan_id: plan.id,
      amount_ugx: amountCheck.amountPaidUgx,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      raw_payload: rawPayload,
      status: 'successful',
      provider_tx_ref: txRef,
    })
  } catch {
    invoiceNo = null
  }

  return {
    ok: true,
    paymentId: payment.id,
    subscriptionId: subAfter.id,
    invoiceNo,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    activationSource,
    paymentStatus: amountCheck.paymentStatus,
    canonicalPriceUgx: plan.priceUgx,
    amountPaidUgx: amountCheck.amountPaidUgx,
    varianceUgx: amountCheck.varianceUgx,
  }
}

/** Exported for tests — stamp helper reuse */
export { kampalaStamp, addBillingCycle }
