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

export { requireFeature, requireActiveSubscription, checkFeature, gateFeature, subscriptionRequiredResponse, FeatureGateError } from './features'
export {
  getSubscriptionStatus,
  listSubscriptionPayments,
  listAllPayments,
  listActivePharmacyPlans,
  listSubscriptionInvoices,
  getSubscriptionInvoice,
  initiateSubscriptionPayment,
  confirmSubscriptionPayment,
  handleFlutterwaveWebhook,
  isTenantEntitled,
  billingCycleMonths,
  addBillingCycle,
  kampalaStamp,
  kampalaDateYMD,
  kampalaMidnightUtc,
  recordAndSendTrialReceipt,
} from './billing/subscription'
export type {
  SubscriptionStatus,
  PaymentRow,
  ActivePlanRow,
  InitSubscribeInput,
  InitSubscribeResult,
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  BillingCycle,
  TrialReceiptInput,
  SubscriptionInvoiceRow,
} from './billing/subscription'
export {
  evaluateEntitlement,
  ENTITLED_STATUSES,
  BLOCKED_STATUSES,
} from './billing/entitlement'
export type { EntitlementInput, EntitlementResult } from './billing/entitlement'
export { verifyWebhookHash } from './billing/flutterwave'
export {
  PHARMACY_INVENTORY_MUTATOR_ROLES,
  canMutatePharmacyInventory,
} from './pharmacy-mobile-roles'
