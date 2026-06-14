// Shared MFA JWT helpers — safe for Node and Edge runtimes (no next/headers)

import { SignJWT, jwtVerify } from 'jose'

export const MFA_PENDING_COOKIE = 'synapse_mfa_pending'
export const PHARM_MFA_SATISFIED_COOKIE = 'synapse_pharm_mfa_satisfied'

const ISSUER = 'synapse-health-technologies'
const AUDIENCE = 'synapse-platform'

const MFA_PENDING_TTL_SECONDS = 900 // 15 minutes
const PHARM_MFA_SATISFIED_TTL_SECONDS = 86_400 // 24 hours

function getSecret(): Uint8Array {
  const secret = process.env.SYNAPSE_JWT_SECRET
  if (!secret) throw new Error('[SYNAPSE] SYNAPSE_JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signMfaPendingToken(params: {
  sub: string
  email: string
}): Promise<string> {
  return new SignJWT({ sub: params.sub, email: params.email, purpose: 'totp_pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${MFA_PENDING_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifyMfaPendingToken(
  token: string
): Promise<{ sub: string; email: string }> {
  const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER, audience: AUDIENCE })
  if (payload['purpose'] !== 'totp_pending') throw new Error('Token purpose mismatch')
  if (typeof payload.sub !== 'string') throw new Error('Token missing sub')
  const email = payload['email']
  if (typeof email !== 'string') throw new Error('Token missing email')
  return { sub: payload.sub, email }
}

export async function signPharmMfaSatisfiedToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, purpose: 'pharm_mfa_satisfied' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${PHARM_MFA_SATISFIED_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifyPharmMfaSatisfiedToken(
  token: string,
  userId: string
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER, audience: AUDIENCE })
    return payload['purpose'] === 'pharm_mfa_satisfied' && payload.sub === userId
  } catch {
    return false
  }
}

export const mfaCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: MFA_PENDING_TTL_SECONDS,
  path: '/',
}

export const pharmMfaCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: PHARM_MFA_SATISFIED_TTL_SECONDS,
  path: '/',
}
