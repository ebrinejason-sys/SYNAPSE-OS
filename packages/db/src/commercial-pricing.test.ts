import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CANONICAL_PLAN_SLUGS,
  FALLBACK_PUBLIC_PLANS,
  buildPlanUpdatePayload,
  findPlanBySlug,
  formatUgxAnnual,
  mapPlanRow,
  osWithLabBundlePrice,
  publicPlansOnly,
  snapshotSubscriptionTerms,
} from './commercial-pricing.ts'

describe('commercial pricing domain', () => {
  it('exposes canonical annual public fallback prices', () => {
    const plans = publicPlansOnly(FALLBACK_PUBLIC_PLANS)
    assert.equal(findPlanBySlug(plans, CANONICAL_PLAN_SLUGS.pharmacy)?.priceUgx, 240_000)
    assert.equal(findPlanBySlug(plans, CANONICAL_PLAN_SLUGS.lab)?.priceUgx, 1_000_000)
    assert.equal(findPlanBySlug(plans, CANONICAL_PLAN_SLUGS.osBasic)?.priceUgx, 1_500_000)
    assert.equal(findPlanBySlug(plans, CANONICAL_PLAN_SLUGS.osLabAddon)?.priceUgx, 500_000)
    assert.equal(findPlanBySlug(plans, CANONICAL_PLAN_SLUGS.enterprise)?.pricingState, 'CUSTOM_QUOTE')
  })

  it('models OS + Lab add-on as distinct from standalone Lab', () => {
    const { os, labAddon, standaloneLab, combinedUgx } = osWithLabBundlePrice(FALLBACK_PUBLIC_PLANS)
    assert.ok(os)
    assert.ok(labAddon)
    assert.ok(standaloneLab)
    assert.equal(labAddon?.pricingState, 'ADD_ON')
    assert.equal(labAddon?.priceUgx, 500_000)
    assert.equal(standaloneLab?.priceUgx, 1_000_000)
    assert.notEqual(labAddon?.priceUgx, standaloneLab?.priceUgx)
    assert.equal(combinedUgx, 2_000_000)
  })

  it('formats annual UGX and custom states', () => {
    assert.equal(formatUgxAnnual(240_000, 'PUBLIC_FIXED'), 'UGX 240,000 / year')
    assert.match(formatUgxAnnual(1_500_000, 'STARTING_AT'), /Starting at/)
    assert.match(formatUgxAnnual(500_000, 'ADD_ON'), /^\+ /)
    assert.equal(formatUgxAnnual(null, 'CUSTOM_QUOTE'), 'Custom pricing')
    assert.equal(formatUgxAnnual(null, 'COMING_SOON'), 'Coming soon')
  })

  it('snapshots subscription terms without coupling to later catalog edits', () => {
    const plan = findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.osBasic)!
    const addon = findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.osLabAddon)!
    const snap = snapshotSubscriptionTerms({ plan, addons: [addon], discountUgx: 0 })
    assert.equal(snap.agreedPriceUgx, 1_500_000)
    assert.equal(snap.addonTotalUgx, 500_000)
    assert.deepEqual(snap.addonSlugs, [CANONICAL_PLAN_SLUGS.osLabAddon])

    const mutated = { ...plan, priceUgx: 9_999_999 }
    assert.equal(snap.agreedPriceUgx, 1_500_000)
    assert.notEqual(snap.agreedPriceUgx, mutated.priceUgx)
  })

  it('records price history payload when catalog prices change', () => {
    const plan = {
      ...findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.pharmacy)!,
      id: 'plan-1',
    }
    const { planPatch, historyRow } = buildPlanUpdatePayload(
      plan,
      { priceUgx: 260_000, changeReason: 'annual adjustment' },
      'actor-1',
    )
    assert.equal(planPatch.price_ugx, 260_000)
    assert.equal(planPatch.previous_price_ugx, 240_000)
    assert.ok(historyRow)
    assert.equal(historyRow?.previous_price_ugx, 240_000)
    assert.equal(historyRow?.new_price_ugx, 260_000)
    assert.equal(historyRow?.changed_by, 'actor-1')
  })

  it('maps database rows into commercial plans', () => {
    const plan = mapPlanRow({
      id: 'x',
      slug: 'synapse_pharmacy_annual',
      name: 'SYNAPSE Pharmacy',
      facility_type: 'pharmacy',
      price_ugx: '240000',
      pricing_state: 'PUBLIC_FIXED',
      feature_list: ['Inventory', 'POS'],
      public_visible: true,
      is_active: true,
      display_order: 10,
    })
    assert.equal(plan.priceUgx, 240_000)
    assert.deepEqual(plan.featureList, ['Inventory', 'POS'])
  })

  it('hides inactive or HIDDEN plans from public lists', () => {
    const hidden = publicPlansOnly([
      { ...FALLBACK_PUBLIC_PLANS[0], pricingState: 'HIDDEN' },
      { ...FALLBACK_PUBLIC_PLANS[1], isActive: false },
      FALLBACK_PUBLIC_PLANS[2],
    ])
    assert.equal(hidden.length, 1)
    assert.equal(hidden[0]?.slug, CANONICAL_PLAN_SLUGS.osBasic)
  })
})
