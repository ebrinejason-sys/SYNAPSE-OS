/**
 * Canonical Pharmacy capabilities live in @synapse/auth so mobile BFF and portal share one table.
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
} from "@synapse/auth"
export type { PharmacyCapability, PharmacyCapabilityRole, CapabilitySession } from "@synapse/auth"
