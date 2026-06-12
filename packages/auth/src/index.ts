// packages/auth/src/index.ts
// Do NOT import context.server from this barrel — it has next/headers
// Import explicitly: import { getContext } from '@synapse/auth/context'

export { signToken, verifyToken, signShortToken, verifyShortToken } from './tokens'
export type { SynapseTokenPayload } from './tokens'

export { hashPassword, verifyPassword, validatePasswordStrength } from './password'

export {
  createAndSendOTP, verifyOTP,
  generateOTP, hashOTP, verifyOTPHash,
} from './otp'

export {
  createSession, validateSession, revokeSession, revokeAllUserSessions, hashToken,
} from './sessions'
