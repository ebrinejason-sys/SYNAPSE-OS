import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  computeSubscriptionPeriod,
  validateManualActivationAmounts,
  resolveBillingCycleForPlan,
  isManualPaymentMethod,
} from './manual-activation.ts'
import { addBillingCycle } from './subscription.ts'

describe('manual payment methods', () => {
  it('accepts stable enum values', () => {
    assert.equal(isManualPaymentMethod('CASH'), true)
    assert.equal(isManualPaymentMethod('BANK_TRANSFER'), true)
    assert.equal(isManualPaymentMethod('MOBILE_MONEY_MANUAL'), true)
    assert.equal(isManualPaymentMethod('COMPLIMENTARY'), true)
    assert.equal(isManualPaymentMethod('cash'), false)
    assert.equal(isManualPaymentMethod('FLUTTERWAVE'), false)
  })
})

describe('validateManualActivationAmounts', () => {
  it('requires OTHER description', () => {
    const r = validateManualActivationAmounts({
      method: 'OTHER',
      canonicalPriceUgx: 240000,
      customQuote: false,
      amountPaidUgx: 240000,
      priceOverride: false,
      canOverridePrice: false,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, 'OTHER_DESCRIPTION_REQUIRED')
  })

  it('requires complimentary reason and does not treat as cash zero', () => {
    const missing = validateManualActivationAmounts({
      method: 'COMPLIMENTARY',
      canonicalPriceUgx: 240000,
      customQuote: false,
      amountPaidUgx: 0,
      priceOverride: false,
      canOverridePrice: false,
    })
    assert.equal(missing.ok, false)

    const ok = validateManualActivationAmounts({
      method: 'COMPLIMENTARY',
      canonicalPriceUgx: 240000,
      customQuote: false,
      amountPaidUgx: 0,
      priceOverride: false,
      canOverridePrice: false,
      complimentaryReason: 'Pilot pilot facility',
    })
    assert.equal(ok.ok, true)
    if (ok.ok) {
      assert.equal(ok.paymentStatus, 'waived')
      assert.equal(ok.amountPaidUgx, 0)
    }
  })

  it('rejects underpayment without override', () => {
    const r = validateManualActivationAmounts({
      method: 'CASH',
      canonicalPriceUgx: 240000,
      customQuote: false,
      amountPaidUgx: 100000,
      priceOverride: false,
      canOverridePrice: true,
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, 'UNDERPAYMENT')
  })

  it('rejects underpayment override without capability', () => {
    const r = validateManualActivationAmounts({
      method: 'BANK_TRANSFER',
      canonicalPriceUgx: 240000,
      customQuote: false,
      amountPaidUgx: 100000,
      priceOverride: true,
      canOverridePrice: false,
      overrideReason: 'Discount',
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.code, 'OVERRIDE_FORBIDDEN')
  })

  it('allows authorized underpayment override with reason', () => {
    const r = validateManualActivationAmounts({
      method: 'CASH',
      canonicalPriceUgx: 240000,
      customQuote: false,
      amountPaidUgx: 200000,
      priceOverride: true,
      canOverridePrice: true,
      overrideReason: 'Negotiated discount',
    })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.varianceUgx, -40000)
      assert.equal(r.paymentStatus, 'paid')
    }
  })

  it('accepts exact cash / bank / momo amounts', () => {
    for (const method of ['CASH', 'BANK_TRANSFER', 'BANK_DEPOSIT', 'MOBILE_MONEY_MANUAL', 'CHEQUE', 'POS_CARD'] as const) {
      const r = validateManualActivationAmounts({
        method,
        canonicalPriceUgx: 240000,
        customQuote: false,
        amountPaidUgx: 240000,
        priceOverride: false,
        canOverridePrice: false,
      })
      assert.equal(r.ok, true, method)
    }
  })

  it('requires positive amount for custom quote', () => {
    const bad = validateManualActivationAmounts({
      method: 'BANK_TRANSFER',
      canonicalPriceUgx: null,
      customQuote: true,
      amountPaidUgx: 0,
      priceOverride: false,
      canOverridePrice: true,
    })
    assert.equal(bad.ok, false)

    const ok = validateManualActivationAmounts({
      method: 'BANK_TRANSFER',
      canonicalPriceUgx: null,
      customQuote: true,
      amountPaidUgx: 5_000_000,
      priceOverride: false,
      canOverridePrice: true,
    })
    assert.equal(ok.ok, true)
    if (ok.ok) assert.equal(ok.amountPaidUgx, 5_000_000)
  })
})

describe('computeSubscriptionPeriod / early renewal', () => {
  it('computes annual expiry from start via calendar months', () => {
    const start = new Date('2026-09-23T10:00:00.000Z')
    const end = addBillingCycle(start, 'yearly')
    assert.equal(end.toISOString().slice(0, 10), '2027-09-23')
  })

  it('early renewal extends from existing expiry, not payment date', () => {
    const now = new Date('2027-09-01T12:00:00.000Z')
    const window = computeSubscriptionPeriod({
      now,
      existingStatus: 'active',
      existingPeriodEnd: '2027-09-23T10:00:00.000Z',
      billingCycle: 'yearly',
    })
    assert.equal(window.extendedExisting, true)
    assert.equal(window.periodStart.toISOString().slice(0, 10), '2027-09-23')
    assert.equal(window.periodEnd.toISOString().slice(0, 10), '2028-09-23')
  })

  it('expired renewal starts from now (or effective start), not shortening', () => {
    const now = new Date('2027-10-01T12:00:00.000Z')
    const window = computeSubscriptionPeriod({
      now,
      existingStatus: 'expired',
      existingPeriodEnd: '2027-09-23T10:00:00.000Z',
      billingCycle: 'yearly',
    })
    assert.equal(window.extendedExisting, false)
    assert.equal(window.periodStart.toISOString(), now.toISOString())
    assert.equal(window.periodEnd.toISOString().slice(0, 10), '2028-10-01')
  })

  it('respects authorized effective start for new activations', () => {
    const now = new Date('2026-09-23T12:00:00.000Z')
    const start = new Date('2026-10-01T00:00:00.000Z')
    const window = computeSubscriptionPeriod({
      now,
      existingStatus: null,
      existingPeriodEnd: null,
      billingCycle: 'yearly',
      effectiveStartAt: start,
    })
    assert.equal(window.periodStart.toISOString(), start.toISOString())
    assert.equal(window.periodEnd.toISOString().slice(0, 10), '2027-10-01')
  })
})

describe('resolveBillingCycleForPlan', () => {
  it('maps annual catalog periods to yearly', () => {
    assert.equal(resolveBillingCycleForPlan({ billingPeriod: 'annual' }), 'yearly')
    assert.equal(resolveBillingCycleForPlan({ billingCycle: 'yearly' }), 'yearly')
    assert.equal(resolveBillingCycleForPlan({ billingPeriod: 'monthly' }), 'monthly')
  })
})
