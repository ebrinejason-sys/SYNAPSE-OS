import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

describe('check-security-gates', () => {
  it('passes on the current #120 branch tree', () => {
    const r = spawnSync(process.execPath, ['scripts/check-security-gates.mjs'], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /SECURITY GATES PASS/)
  })

  it('is wired into verify and exposes npm script', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    assert.equal(pkg.scripts['test:security-gates'], 'node scripts/check-security-gates.mjs')
    assert.match(pkg.scripts.verify, /test:security-gates/)
  })

  it('guards the profiles migration and browser pages', () => {
    const src = readFileSync('scripts/check-security-gates.mjs', 'utf8')
    assert.match(src, /privileged_profile_column_grant/)
    assert.match(src, /browser_profiles_write/)
    assert.match(src, /create_table_missing_rls/)
    assert.match(src, /permissive_policy/)
    assert.match(src, /20261003160000/)
  })
})
