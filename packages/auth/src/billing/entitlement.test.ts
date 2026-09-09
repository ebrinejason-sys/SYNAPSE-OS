import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveEffectiveSubscription } from './entitlement.ts'

describe('effective subscription resolution', () => {
  const now = new Date('2026-09-09T12:00:00.000Z')

  it('uses an active manual grant without changing payment truth', () => {
    const result = resolveEffectiveSubscription(
      { status: 'suspended', planSlug: 'starter', planName: 'Starter' },
      [{ id: 'grant-1', planSlug: 'pilot', planName: 'Pilot', starts_at: '2026-09-01T00:00:00.000Z', ends_at: '2026-12-01T00:00:00.000Z', status: 'ACTIVE', reason: 'Pilot onboarding' }],
      now,
    )
    assert.equal(result.entitled, true)
    assert.equal(result.source, 'MANUAL_GRANT')
    assert.equal(result.paymentStatus, 'NOT_REQUIRED')
    assert.equal(result.grantId, 'grant-1')
    assert.equal(result.planSlug, 'pilot')
  })

  it('does not activate a future or expired grant', () => {
    const future = resolveEffectiveSubscription(null, [{ id: 'future', starts_at: '2026-09-10T00:00:00.000Z', ends_at: '2026-12-01T00:00:00.000Z', status: 'SCHEDULED' }], now)
    assert.equal(future.entitled, true)
    assert.equal(future.source, 'NONE')
    const expired = resolveEffectiveSubscription(null, [{ id: 'expired', starts_at: '2026-01-01T00:00:00.000Z', ends_at: '2026-09-01T00:00:00.000Z', status: 'EXPIRED' }], now)
    assert.equal(expired.source, 'NONE')
  })

  it('keeps paid access after a manual grant is revoked', () => {
    const result = resolveEffectiveSubscription(
      { status: 'active', current_period_end: '2026-10-01T00:00:00.000Z', planSlug: 'professional' },
      [{ id: 'revoked', starts_at: '2026-09-01T00:00:00.000Z', ends_at: '2026-12-01T00:00:00.000Z', status: 'REVOKED' }],
      now,
    )
    assert.equal(result.entitled, true)
    assert.equal(result.source, 'PAID')
    assert.equal(result.paymentStatus, 'PAID')
  })
})
