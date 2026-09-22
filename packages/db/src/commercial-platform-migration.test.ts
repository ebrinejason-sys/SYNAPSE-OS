import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const migration = readFileSync(
  join(root, 'supabase/migrations/20260922170000_commercial_platform.sql'),
  'utf8',
)

describe('commercial platform migration contract', () => {
  it('seeds annual Pharmacy, Lab, OS Basic, OS Lab add-on, and Enterprise', () => {
    assert.match(migration, /synapse_pharmacy_annual/)
    assert.match(migration, /240000/)
    assert.match(migration, /synapse_lab_annual/)
    assert.match(migration, /1000000/)
    assert.match(migration, /synapse_os_basic_annual/)
    assert.match(migration, /1500000/)
    assert.match(migration, /synapse_os_lab_addon_annual/)
    assert.match(migration, /500000/)
    assert.match(migration, /synapse_enterprise/)
    assert.match(migration, /CUSTOM_QUOTE/)
    assert.match(migration, /ADD_ON/)
  })

  it('keeps commercial CRM and meetings platform-scoped with public insert for requests', () => {
    assert.match(migration, /commercial_meetings/)
    assert.match(migration, /commercial_lead_activities/)
    assert.match(migration, /commercial_price_history/)
    assert.match(migration, /hospital_leads_public_insert/)
    assert.match(migration, /commercial_meetings_public_insert/)
    assert.match(migration, /is_platform_admin\(\)/)
  })

  it('snapshots commercial terms on tenant_subscriptions without deleting history', () => {
    assert.match(migration, /agreed_price_ugx/)
    assert.match(migration, /addon_slugs/)
    assert.doesNotMatch(migration, /DELETE FROM tenant_subscriptions/i)
  })
})
