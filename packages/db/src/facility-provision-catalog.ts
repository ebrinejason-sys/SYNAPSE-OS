/**
 * Facility provisioning catalog — hospitals, clinics, pharmacies, laboratories.
 * Client-safe (no DB imports).
 */

import {
  defaultModulesForLevel,
  slugify as hospitalSlugify,
  type FacilityLevel,
} from "./hospital-provision-catalog"

export {
  CANONICAL_HOSPITAL_MODULES,
  FACILITY_LEVELS,
  FACILITY_OWNERSHIP,
  LEGACY_MODULE_KEY_MAP,
  defaultModulesForLevel,
  normalizeModuleKeys,
  slugify,
  type FacilityLevel,
  type FacilityOwnership,
} from "./hospital-provision-catalog"

export const FACILITY_TYPES = [
  "hospital",
  "clinic",
  "health_centre",
  "pharmacy",
  "laboratory",
] as const
export type FacilityType = (typeof FACILITY_TYPES)[number]

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  hospital: "Hospital",
  clinic: "Clinic",
  health_centre: "Health Centre",
  pharmacy: "Pharmacy",
  laboratory: "Laboratory",
}

/** Standalone pharmacy capability keys (not hospital dispensing). */
export const PHARMACY_FACILITY_MODULES = [
  { key: "pharmacy_core", label: "Pharmacy Core", defaultEnabled: true },
  { key: "inventory", label: "Inventory / FEFO", defaultEnabled: true },
  { key: "pos", label: "POS / Cashier", defaultEnabled: true },
  { key: "dispensing", label: "Dispensing", defaultEnabled: true },
  { key: "prescription_fulfillment", label: "Prescription Fulfilment", defaultEnabled: true },
  { key: "pharmacy_network", label: "Pharmacy Network", defaultEnabled: true },
  { key: "staff", label: "Staff", defaultEnabled: true },
  { key: "reports", label: "Reports", defaultEnabled: true },
  { key: "offline_first_pos", label: "Offline POS", defaultEnabled: true },
  { key: "in_app_orders", label: "In-app Orders", defaultEnabled: true },
  { key: "sms_refill_reminders", label: "SMS Refill Reminders", defaultEnabled: false },
  { key: "inventory_migration", label: "Inventory Migration", defaultEnabled: false },
] as const

export const LABORATORY_FACILITY_MODULES = [
  { key: "core", label: "Facility Core", defaultEnabled: true },
  { key: "registration", label: "Registration", defaultEnabled: true },
  { key: "lab", label: "Laboratory", defaultEnabled: true },
  { key: "billing", label: "Billing", defaultEnabled: true },
  { key: "reports", label: "Reports", defaultEnabled: true },
  { key: "claims", label: "Claims", defaultEnabled: false },
  { key: "public_health", label: "Public Health", defaultEnabled: false },
  { key: "migration", label: "Data Migration", defaultEnabled: false },
] as const

export const CLINIC_DEFAULT_MODULES: string[] = [
  "core",
  "registration",
  "opd",
  "clinical",
  "billing",
  "reports",
]

export function defaultModulesForFacilityType(
  facilityType: FacilityType,
  facilityLevel?: string,
  options?: { includeLab?: boolean; includeDispensing?: boolean },
): string[] {
  if (facilityType === "pharmacy") {
    return PHARMACY_FACILITY_MODULES.filter((m) => m.defaultEnabled).map((m) => m.key)
  }
  if (facilityType === "laboratory") {
    return LABORATORY_FACILITY_MODULES.filter((m) => m.defaultEnabled).map((m) => m.key)
  }
  if (facilityType === "clinic" || facilityType === "health_centre") {
    const mods = [...CLINIC_DEFAULT_MODULES]
    if (options?.includeLab) mods.push("lab")
    if (options?.includeDispensing) mods.push("dispensing")
    return mods
  }
  // hospital — reuse level defaults from hospital catalog
  return defaultModulesForLevel((facilityLevel as FacilityLevel) || "GENERAL_HOSPITAL")
}

export function pharmacyTenantSlug(raw: string): string {
  const base = hospitalSlugify(raw).replace(/^pharm-/, "")
  return `pharm-${base}`
}

export function pharmacyLoginUrl(tenantSlug: string): string {
  const slug = tenantSlug.replace(/^pharm-/, "")
  return `https://pharm.synapseos.tech/login?tenant=${encodeURIComponent(slug)}`
}
