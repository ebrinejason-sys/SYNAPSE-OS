/** Synthetic Test Drive emails never receive Resend; OTP is still stored hashed. */
export function shouldSkipOtpEmailDelivery(input: {
  isSyntheticTenant?: boolean | null
  email?: string | null
}): boolean {
  const email = String(input.email || "").trim().toLowerCase()
  if (input.isSyntheticTenant) return true
  return email.endsWith(".invalid") || email.endsWith(".synapseos.test") || email.includes("+e2e@")
}
