// packages/auth/src/tokens.ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const ISSUER = 'synapse-health-technologies'
const AUDIENCE = 'synapse-platform'

function getSecret(): Uint8Array {
  const secret = process.env.SYNAPSE_JWT_SECRET
  if (!secret) throw new Error('[SYNAPSE] SYNAPSE_JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export interface SynapseTokenPayload extends JWTPayload {
  sub: string
  email: string
  role: string
  tenant_id: string
  app: 'web' | 'pharmacy' | 'mobile'
  synapse_id?: string
  is_impersonation?: boolean
  impersonator_id?: string
}

export async function signToken(
  payload: Omit<SynapseTokenPayload, 'iat' | 'exp' | 'iss' | 'aud'>,
  expiresIn: string = '7d'
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<SynapseTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  return payload as SynapseTokenPayload
}

export async function signShortToken(params: {
  sub: string
  purpose: 'reset' | 'verify' | 'invite'
}, expiresIn: string = '15m'): Promise<string> {
  return new SignJWT(params)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

export async function verifyShortToken(
  token: string,
  purpose: 'reset' | 'verify' | 'invite'
): Promise<{ sub: string; purpose: string }> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  if (payload['purpose'] !== purpose) {
    throw new Error(`Token purpose mismatch: expected ${purpose}, got ${String(payload['purpose'])}`)
  }
  if (typeof payload.sub !== 'string') {
    throw new Error('Token missing sub claim')
  }
  return { sub: payload.sub, purpose: payload['purpose'] as string }
}
