import assert from 'node:assert/strict'
import { test } from 'node:test'
import { disposableOnboardingTarget } from './disposable-onboarding-target.mjs'

const env = { SYNAPSE_DISPOSABLE_DB_TEST: 'true', SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-only' }
test('requires explicit opt-in and credentials, never falls back to project credentials', () => {
  assert.throws(() => disposableOnboardingTarget({ ...env, SYNAPSE_DISPOSABLE_DB_TEST: '' }))
  assert.throws(() => disposableOnboardingTarget({ ...env, SUPABASE_SERVICE_ROLE_KEY: '' }))
  assert.throws(() => disposableOnboardingTarget({ ...env, SUPABASE_URL: '' }))
  assert.throws(() => disposableOnboardingTarget(env, ['--project-ref', 'production']))
})
test('rejects remote, credential-bearing, and ambiguous destinations', () => {
  for (const url of ['https://project.supabase.co', 'http://localhost:54321', 'http://127.0.0.1.evil.test', 'ftp://127.0.0.1', 'http://user:password@127.0.0.1', 'http://127.0.0.1/proxy', 'http://127.0.0.1?host=remote']) {
    assert.throws(() => disposableOnboardingTarget({ ...env, SUPABASE_URL: url }))
  }
})
test('accepts explicit literal loopback targets', () => {
  assert.equal(disposableOnboardingTarget(env).url, 'http://127.0.0.1:54321')
  assert.equal(disposableOnboardingTarget({ ...env, SUPABASE_URL: 'http://[::1]:54321' }).url, 'http://[::1]:54321')
})
