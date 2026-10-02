import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertPlanMatchesFacility, SubscriptionPlanError } from './subscription.ts'

describe('checkout plan must match tenant facility type', () => {
  it('pharmacy tenant may buy the pharmacy plan', () => {
    assert.doesNotThrow(() => assertPlanMatchesFacility('pharmacy', 'pharmacy'))
  })
  for (const plan of ['hospital', 'laboratory']) {
    it(`pharmacy tenant may NOT buy a ${plan} plan`, () => {
      assert.throws(
        () => assertPlanMatchesFacility(plan, 'pharmacy'),
        (e: unknown) => e instanceof SubscriptionPlanError && e.code === 'PLAN_FACILITY_MISMATCH',
      )
    })
  }
  it('hospital / lab tenants may NOT buy the pharmacy plan', () => {
    assert.throws(() => assertPlanMatchesFacility('pharmacy', 'hospital'), SubscriptionPlanError)
    assert.throws(() => assertPlanMatchesFacility('pharmacy', 'laboratory'), SubscriptionPlanError)
  })
  it('clinic counts as hospital; lab alias counts as laboratory', () => {
    assert.doesNotThrow(() => assertPlanMatchesFacility('hospital', 'clinic'))
    assert.doesNotThrow(() => assertPlanMatchesFacility('laboratory', 'lab'))
  })
  it('legacy tenants without facility_type are not locked out', () => {
    assert.doesNotThrow(() => assertPlanMatchesFacility('pharmacy', null))
  })
})
