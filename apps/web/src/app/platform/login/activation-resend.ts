/**
 * Platform login: activation-resend affordance.
 *
 * The affordance is only offered when the server has classified the account as
 * genuinely unverified, which password-login only discloses AFTER the password
 * was verified (code ACCOUNT_UNVERIFIED). Archived/suspended accounts get
 * ACCOUNT_UNAVAILABLE and never see it. Resending reuses the canonical public
 * endpoint (rate-limited, anti-enumeration).
 */

export const ACTIVATION_RESEND_ENDPOINT = '/api/auth/activation/resend'

export const ACTIVATION_RESEND_OK_MESSAGE =
  'If this account is still pending activation, a new activation email is on its way. Check your inbox and spam folder.'

export function shouldOfferActivationResend(
  status: number,
  body: { code?: unknown; activationRequired?: unknown } | null | undefined,
): boolean {
  return status === 403 && body?.code === 'ACCOUNT_UNVERIFIED' && body?.activationRequired === true
}

export async function requestActivationResend(
  email: string,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetcher(ACTIVATION_RESEND_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (res.ok) return { ok: true, message: ACTIVATION_RESEND_OK_MESSAGE }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  return { ok: false, message: data.error ?? 'Could not resend activation email.' }
}
