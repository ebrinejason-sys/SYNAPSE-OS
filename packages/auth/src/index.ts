// packages/auth/src/index.ts
// Do NOT import context.server from this barrel — it has next/headers
// Import explicitly: import { getContext } from '@synapse/auth/context'

export { signToken, verifyToken, signShortToken, verifyShortToken } from './tokens'
export type { SynapseTokenPayload } from './tokens'

export { ACCOUNT_ACTIVATION_ERROR, isAccountActivated } from './activation'

export { hashPassword, verifyPassword, validatePasswordStrength } from './password'

export {
  createAndSendOTP, verifyOTP,
  generateOTP, hashOTP, verifyOTPHash,
} from './otp'

export {
  createSession, validateSession, revokeSession, revokeAllUserSessions, hashToken,
} from './sessions'

export { requireCapability, checkCapability, CapabilityError } from './capability'

export { generateTotpSecret, totpUri, verifyTotp } from './totp'

export {
  MFA_PENDING_COOKIE,
  PHARM_MFA_SATISFIED_COOKIE,
  signMfaPendingToken,
  verifyMfaPendingToken,
  signPharmMfaSatisfiedToken,
  verifyPharmMfaSatisfiedToken,
  mfaCookieOptions,
  pharmMfaCookieOptions,
} from './mfa'

export { requireFeature, checkFeature, FeatureGateError } from './features'
