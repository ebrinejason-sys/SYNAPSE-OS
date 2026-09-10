import { describe, expect, it } from 'vitest'
import { staffInviteSchema, staffRolePatchSchema } from './hospital-admin/schemas'
import { getPostLoginPath } from '@synapse/auth/redirects'
import { resolveDashboardForUser } from './dashboard/resolver'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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
  it('keeps the facility invitation path unconditionally fail-closed with no reachable legacy handler', () => {
    const route = readFileSync(join(process.cwd(), 'apps/web/src/app/api/platform/facilities/[id]/staff/route.ts'), 'utf8')
    expect(route).toContain('requirePlatformAdminApi("user.invite")')
    expect(route).toContain('FACILITY_INVITE_HARDENING_REQUIRED')
    expect(route).not.toContain('FACILITY_INVITE_HARDENED')
    expect(route).not.toContain('facility_invitations')
    expect(route).not.toContain('profiles')
  })
  it('does not wire the implemented-but-unverified invitation create/redeem module into the live route yet', () => {
    const route = readFileSync(join(process.cwd(), 'apps/web/src/app/api/platform/facilities/[id]/staff/route.ts'), 'utf8')
    expect(route).not.toContain('facility-invitations.server')
    expect(route).not.toContain('createFacilityInvitation')
  })
})
