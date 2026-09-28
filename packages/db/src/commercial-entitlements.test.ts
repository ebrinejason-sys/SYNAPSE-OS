import { describe, expect, it } from 'vitest'
import {
  commercialPlanSlug,
  planIncludesFeature,
  OS_BASIC_FEATURES,
} from './commercial-entitlements'

describe('commercial plan entitlements', () => {
  it('maps new facilities onto the public catalog, not empty legacy hospital plans', () => {
    expect(commercialPlanSlug({ facilityType: 'hospital' })).toBe('synapse_os_basic_annual')
    expect(commercialPlanSlug({ facilityType: 'clinic', tier: 'professional' })).toBe('synapse_os_basic_annual')
    expect(commercialPlanSlug({ facilityType: 'hospital', includeLabAddon: true })).toBe('synapse_os_lab_addon_annual')
    expect(commercialPlanSlug({ facilityType: 'laboratory' })).toBe('synapse_lab_annual')
    expect(commercialPlanSlug({ facilityType: 'laboratory', includeLabAddon: true })).toBe('synapse_lab_annual')
    expect(commercialPlanSlug({ facilityType: 'pharmacy', tier: 'enterprise' })).toBe('synapse_pharmacy_annual')
    expect(commercialPlanSlug({ facilityType: 'hospital', tier: 'enterprise' })).toBe('synapse_enterprise')
  })

  it('allows clinical work on OS Basic and blocks lab until the add-on', () => {
    for (const feature of OS_BASIC_FEATURES) {
      expect(planIncludesFeature('synapse_os_basic_annual', feature)).toBe(true)
    }
    expect(planIncludesFeature('synapse_os_basic_annual', 'opd')).toBe(true)
    expect(planIncludesFeature('synapse_os_basic_annual', 'dispensing')).toBe(true)
    expect(planIncludesFeature('synapse_os_basic_annual', 'lab')).toBe(false)
    expect(planIncludesFeature('synapse_os_basic_annual', 'pos.sell')).toBe(false)
    expect(planIncludesFeature('synapse_os_basic_annual', 'purchasing.manage')).toBe(false)
    expect(planIncludesFeature('synapse_os_basic_annual', 'ipd')).toBe(false)

    expect(planIncludesFeature('synapse_os_lab_addon_annual', 'lab')).toBe(true)
    expect(planIncludesFeature('synapse_os_lab_addon_annual', 'opd')).toBe(true)
  })

  it('gives standalone lab and pharmacy their own catalogs and denies everything else', () => {
    expect(planIncludesFeature('synapse_lab_annual', 'lab')).toBe(true)
    expect(planIncludesFeature('synapse_lab_annual', 'opd')).toBe(false)
    expect(planIncludesFeature('synapse_pharmacy_annual', 'pos.sell')).toBe(true)
    expect(planIncludesFeature('synapse_pharmacy_annual', 'opd')).toBe(false)
    expect(planIncludesFeature('synapse_enterprise', 'opd')).toBe(false)
    expect(planIncludesFeature('hospital_starter', 'opd')).toBe(false)
    expect(planIncludesFeature('synapse_os_basic_annual', 'radiology')).toBe(false)
  })
})
