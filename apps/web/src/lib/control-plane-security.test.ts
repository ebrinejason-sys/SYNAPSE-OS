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
  it('wires facility invitations through the hardened create helper with no legacy raw-token path', () => {
    const route = readFileSync(join(process.cwd(), 'apps/web/src/app/api/platform/facilities/[id]/staff/route.ts'), 'utf8')
    expect(route).toContain('requirePlatformAdminApi("user.invite")')
    expect(route).toContain('facility-invitations.server')
    expect(route).toContain('createFacilityInvitation')
    expect(route).not.toContain('FACILITY_INVITE_HARDENING_REQUIRED')
    expect(route).not.toContain('FACILITY_INVITE_HARDENED')
    expect(route).not.toContain('invite_token')
    expect(route).not.toContain('hashPassword')
    expect(route).not.toContain('tempPassword')
  })
  it('keeps redeem on the invitation redeem helper (no inline password overwrite)', () => {
    const redeem = readFileSync(join(process.cwd(), 'apps/web/src/app/api/invite/facility/redeem/route.ts'), 'utf8')
    expect(redeem).toContain('redeemFacilityInvitation')
    expect(redeem).not.toMatch(/\.eq\([\"']invite_token[\"']\)/)
    expect(redeem).not.toMatch(/invite_token:\s/)
    expect(redeem).not.toContain('password_hash')
    expect(redeem).not.toContain('onboarding_complete: true')
  })
})
