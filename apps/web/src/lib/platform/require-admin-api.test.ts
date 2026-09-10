import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('platform API admin guard', () => {
  it('uses the canonical capability-aware auth flow instead of the deprecated binary gate', () => {
    const file = join(process.cwd(), 'apps/web/src/lib/platform/require-admin-api.ts')
    const source = readFileSync(file, 'utf8')

    expect(source).toContain('requireCanonicalPlatformAdminApi')
    expect(source).toContain('requirePlatformAdminApi(capability')
    expect(source).not.toContain('if (!user || !hasPlatformAdminAccess')
    expect(source).not.toContain('getCurrentUser()')
  })
})
