import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { DEFAULT_VERCEL_SCOPE, PROJECTS, resolveScope, vercelAddArgs } from './sync-flutterwave-vercel.mjs'

describe('sync-flutterwave-vercel (never executed against Vercel here)', () => {
  it('defaults to the synapse-os1 team, not the stale personal scope', () => {
    assert.equal(DEFAULT_VERCEL_SCOPE, 'synapse-os1')
    assert.equal(resolveScope(['node', 'x'], {}), 'synapse-os1')
    const src = readFileSync(new URL('./sync-flutterwave-vercel.mjs', import.meta.url), 'utf8')
    assert.doesNotMatch(src, /const SCOPE = 'ebrines-projects-d0493afe'/)
  })
  it('scope comes from --scope, --scope= or VERCEL_SCOPE', () => {
    assert.equal(resolveScope(['node', 'x', '--scope', 'team-a'], {}), 'team-a')
    assert.equal(resolveScope(['node', 'x', '--scope=team-b'], {}), 'team-b')
    assert.equal(resolveScope(['node', 'x'], { VERCEL_SCOPE: 'team-c' }), 'team-c')
    assert.equal(resolveScope(['node', 'x', '--scope', '--dry-run'], {}), 'synapse-os1')
  })
  it('pharmacy project syncs Resend + JWT secret; web syncs RESEND_FROM_EMAIL', () => {
    for (const k of ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'SYNAPSE_JWT_SECRET']) {
      assert.ok(PROJECTS.pharmacy.vars.includes(k), `pharmacy missing ${k}`)
    }
    assert.ok(PROJECTS.web.vars.includes('RESEND_FROM_EMAIL'))
    assert.ok(PROJECTS.web.vars.includes('RESEND_API_KEY'))
  })
  it('never puts the value on argv (it is piped on stdin)', () => {
    const args = vercelAddArgs('RESEND_API_KEY', 'production', 'synapse-os1', true)
    assert.deepEqual(args, ['vercel', 'env', 'add', 'RESEND_API_KEY', 'production', '--force', '-S', 'synapse-os1', '--sensitive'])
    assert.ok(!args.includes('--value'))
    const src = readFileSync(new URL('./sync-flutterwave-vercel.mjs', import.meta.url), 'utf8')
    assert.doesNotMatch(src, /shell:\s*true/)
  })
})
