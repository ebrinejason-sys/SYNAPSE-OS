export const E2E_FACILITY_SLUGS = ["synapse-e2e-hospital", "synapse-e2e-hospital-b"] as const

/** Canonical allowlisted synthetic users for trusted acceptance only. */
export const E2E_ROLE_EMAILS = {
  receptionist: "reception.e2e@synapseos.invalid",
  nurse: "nurse.e2e@synapseos.invalid",
  doctor: "doctor.e2e@synapseos.invalid",
  lab_tech: "labtech.e2e@synapseos.invalid",
  lab_scientist: "labscientist.e2e@synapseos.invalid",
  pharmacist: "pharmacist.e2e@synapseos.invalid",
  billing_officer: "cashier.e2e@synapseos.invalid",
  hospital_admin: "admin.e2e@synapseos.invalid",
  doctor_b: "doctor.b.e2e@synapseos.invalid",
} as const

export type E2eOtpContext = {
  isSyntheticTenant?: boolean | null
  facilitySlug?: string | null
}

export function isE2eAllowlistedEmail(email: string | null | undefined): boolean {
  const value = String(email || "").trim().toLowerCase()
  if (!value) return false
  return (Object.values(E2E_ROLE_EMAILS) as string[]).includes(value)
}

export function isE2eFacilitySlug(slug: string | null | undefined): boolean {
  return (E2E_FACILITY_SLUGS as readonly string[]).includes(String(slug || ""))
}

function runtimeEnvValue(env: NodeJS.ProcessEnv, name: string): string {
  // Dynamic key access. Next.js inlines `process.env.FOO` at build time.
  // Sensitive Vercel Preview secrets are empty during build, so a static
  // `process.env.SYNAPSE_E2E_FIXED_OTP` would bake a blank override into
  // the server bundle and force random OTPs at runtime.
  return String(env[name] ?? "").trim()
}

export function isE2eAcceptanceRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return runtimeEnvValue(env, "SYNAPSE_E2E_AUTH") === "true"
    && runtimeEnvValue(env, "SYNAPSE_E2E_ACCEPTANCE_ENV") === "true"
    && runtimeEnvValue(env, "VERCEL_ENV") !== "production"
}

export function shouldSkipOtpEmailDelivery(
  input: { email?: string | null } & E2eOtpContext,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const email = String(input.email || "").trim()
  if (!email) return false
  return resolveE2eOtp({
    email,
    isSyntheticTenant: input.isSyntheticTenant,
    facilitySlug: input.facilitySlug,
  }, env) !== null
}

/**
 * Returns a fixed OTP from the protected acceptance environment only when
 * every gate passes. Never used for normal production users.
 *
 * IMPORTANT: these env vars must be present on the **Next.js server process**
 * that issues OTPs. Setting them only on a Playwright runner that hits a remote
 * base URL has no effect — configure them on the remote deployment (Vercel env
 * for SYNAPSE_E2E_BASE_URL) as well as providing SYNAPSE_E2E_FIXED_OTP to the
 * runner so the test can type the same code.
 */
export function resolveE2eOtp(
  input: { email: string } & E2eOtpContext,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!isE2eAcceptanceRuntime(env)) return null
  const otp = runtimeEnvValue(env, "SYNAPSE_E2E_FIXED_OTP")
  if (!/^\d{6}$/.test(otp)) return null
  if (!input.isSyntheticTenant) return null
  if (!isE2eFacilitySlug(input.facilitySlug)) return null
  if (!isE2eAllowlistedEmail(input.email)) return null
  return otp
}

export function assertE2eSeedAllowed(input: {
  seedFlag?: string
  slugA?: string
  slugB?: string
}): void {
  if (input.seedFlag !== "true") {
    throw new Error("Refusing to seed. Set SYNAPSE_E2E_SEED=true")
  }
  if (!isE2eFacilitySlug(input.slugA) || !isE2eFacilitySlug(input.slugB) || input.slugA === input.slugB) {
    throw new Error("Seed only permits synapse-e2e-hospital and synapse-e2e-hospital-b")
  }
}
