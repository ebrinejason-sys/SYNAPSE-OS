import { describe, expect, it } from 'vitest'
import { staffInviteSchema, staffRolePatchSchema } from './hospital-admin/schemas'
import { getPostLoginPath } from '@synapse/auth/redirects'
import { resolveDashboardForUser } from './dashboard/resolver'

describe('facility staff security and laboratory landing', () => {
  it.each(['platform_admin', 'superadmin', 'platform_observer'])('rejects facility-level assignment of %s', role => {
    expect(staffInviteSchema.safeParse({ email: 'synthetic@example.test', full_name: 'Synthetic Staff', role }).success).toBe(false)
    expect(staffRolePatchSchema.safeParse({ role }).success).toBe(false)
  })
  it.each(['lab_admin', 'lab_scientist', 'lab_technician'])('routes %s to the laboratory workspace', role => {
    expect(getPostLoginPath({ role, tenantFacilityType: 'laboratory', emailVerified: true, onboardingComplete: true })).toBe('/lab/orders')
  })
  it('laboratory dashboard excludes hospital-only modules', () => {
    const result = resolveDashboardForUser({ userId: 'user', role: 'lab_admin', tenantId: 'lab', tenantSlug: 'pilot-lab', facilityType: 'laboratory', enabledModules: ['core', 'registration', 'lab', 'billing', 'reports', 'ipd'], subscriptionFeatures: [] })
    expect(result.redirectPath).toBe('/lab/orders')
    expect(result.primaryModules).not.toContain('ipd')
  })
})
