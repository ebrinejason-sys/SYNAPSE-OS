import { describe, expect, it, vi } from 'vitest'
import {
  ACTIVATION_RESEND_ENDPOINT,
  ACTIVATION_RESEND_OK_MESSAGE,
  requestActivationResend,
  shouldOfferActivationResend,
} from './activation-resend'

describe('platform login activation-resend affordance', () => {
  it('is offered only for the server-classified unverified state (post-password)', () => {
    expect(shouldOfferActivationResend(403, { code: 'ACCOUNT_UNVERIFIED', activationRequired: true })).toBe(true)
  })

  it.each([
    ['archived/suspended', 403, { code: 'ACCOUNT_UNAVAILABLE' }],
    ['wrong password / unknown email', 401, { error: 'Invalid email or password' }],
    ['locked', 429, { code: 'ACCOUNT_LOCKED' }],
    ['legacy activation text without code', 403, { error: 'Activate your account from the email we sent before signing in.' }],
    ['code on wrong status', 401, { code: 'ACCOUNT_UNVERIFIED', activationRequired: true }],
    ['empty body', 403, null],
  ])('is not offered for %s', (_l, status, body) => {
    expect(shouldOfferActivationResend(status as number, body as any)).toBe(false)
  })

  it('reuses the canonical resend endpoint and shows a neutral message', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const result = await requestActivationResend('admin@example.test', fetcher as unknown as typeof fetch)
    expect(fetcher).toHaveBeenCalledWith(ACTIVATION_RESEND_ENDPOINT, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'admin@example.test' }),
    }))
    expect(result).toEqual({ ok: true, message: ACTIVATION_RESEND_OK_MESSAGE })
  })

  it('surfaces rate-limit errors from the endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: 'Too many requests. Please wait before trying again.' }), { status: 429 }))
    const result = await requestActivationResend('admin@example.test', fetcher as unknown as typeof fetch)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/Too many requests/)
  })
})
