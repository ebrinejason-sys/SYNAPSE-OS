/**
 * Canonical Pharmacy capabilities live in @synapse/auth so mobile BFF and portal share one table.
 * Import the dedicated subpath — never the auth barrel — so client portal layouts do not pull node:crypto.
 */
export {
  PHARMACY_CAPABILITIES,
  LEGACY_PERMISSION_TO_CAPABILITY,
  ROLE_CAPABILITIES,
  normalizePharmacyRole,
  isPharmacyCapability,
  resolveCapability,
  capabilitiesForRole,
  roleHasCapability,
  sessionHasCapability,
  sessionHasAnyCapability,
} from "@synapse/auth/pharmacy-capabilities"
export type { PharmacyCapability, PharmacyCapabilityRole, CapabilitySession } from "@synapse/auth/pharmacy-capabilities"
