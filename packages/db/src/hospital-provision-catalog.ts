/**
 * Client-safe hospital onboarding catalog (no DB imports).
 */

export const FACILITY_OWNERSHIP = [
  "PUBLIC",
  "PRIVATE",
  "PRIVATE_NOT_FOR_PROFIT",
  "MISSION_FAITH_BASED",
  "NGO",
  "OTHER",
] as const
export type FacilityOwnership = (typeof FACILITY_OWNERSHIP)[number]

export const FACILITY_LEVELS = [
  "CLINIC",
  "HEALTH_CENTRE",
  "GENERAL_HOSPITAL",
  "REGIONAL_REFERRAL_HOSPITAL",
  "NATIONAL_REFERRAL_HOSPITAL",
  "TEACHING_HOSPITAL",
  "SPECIALIST_HOSPITAL",
] as const
export type FacilityLevel = (typeof FACILITY_LEVELS)[number]

export const CANONICAL_HOSPITAL_MODULES = [
  { key: "core", label: "Facility Core", status: "AVAILABLE" as const, defaultEnabled: true },
  { key: "registration", label: "Registration / HIM", status: "AVAILABLE" as const, defaultEnabled: true },
  { key: "opd", label: "OPD / Triage", status: "AVAILABLE" as const, defaultEnabled: true },
  { key: "clinical", label: "Doctor / Clinical", status: "AVAILABLE" as const, defaultEnabled: true },
  { key: "ipd", label: "Nursing / IPD", status: "PILOT" as const, defaultEnabled: false },
  { key: "lab", label: "Laboratory", status: "AVAILABLE" as const, defaultEnabled: true },
  { key: "radiology", label: "Radiology", status: "DEVELOPMENT" as const, defaultEnabled: false },
  { key: "dispensing", label: "Hospital Dispensing", status: "AVAILABLE" as const, defaultEnabled: true },
  { key: "maternity", label: "Maternity", status: "DEVELOPMENT" as const, defaultEnabled: false },
  { key: "immunization", label: "Immunization / Paediatrics", status: "DEVELOPMENT" as const, defaultEnabled: false },
  { key: "theatre", label: "Theatre / Surgery", status: "NOT_IMPLEMENTED" as const, defaultEnabled: false },
  { key: "emergency", label: "Emergency", status: "PILOT" as const, defaultEnabled: true },
  { key: "mortuary", label: "Mortuary", status: "NOT_IMPLEMENTED" as const, defaultEnabled: false },
  { key: "support_ops", label: "Support Operations", status: "DEVELOPMENT" as const, defaultEnabled: false },
  { key: "hr", label: "HR-lite", status: "DEVELOPMENT" as const, defaultEnabled: false },
  { key: "billing", label: "Revenue / Billing", status: "AVAILABLE" as const, defaultEnabled: true },
  { key: "claims", label: "Insurance Claims", status: "PILOT" as const, defaultEnabled: false },
  { key: "telemedicine", label: "Telemedicine", status: "DEVELOPMENT" as const, defaultEnabled: false },
  { key: "reports", label: "Reports", status: "PILOT" as const, defaultEnabled: false },
  { key: "public_health", label: "Public Health", status: "PILOT" as const, defaultEnabled: false },
  { key: "migration", label: "Data Migration", status: "DEVELOPMENT" as const, defaultEnabled: false },
] as const

export const LEGACY_MODULE_KEY_MAP: Record<string, string> = {
  admin: "core",
  front_desk: "registration",
  doctor: "clinical",
  nurse: "ipd",
  pharmacy: "dispensing",
  laboratory: "lab",
  inpatient: "ipd",
  outpatient: "opd",
  insurance: "claims",
  pediatrics: "immunization",
  support: "support_ops",
  analytics: "reports",
  portal: "telemedicine",
  finance: "billing",
  inventory: "support_ops",
}

export function normalizeModuleKeys(keys: string[]): string[] {
  const out = new Set<string>()
  for (const raw of keys) {
    const mapped = LEGACY_MODULE_KEY_MAP[raw] ?? raw
    if (CANONICAL_HOSPITAL_MODULES.some((m) => m.key === mapped)) out.add(mapped)
  }
  out.add("core")
  return [...out]
}

export function defaultModulesForLevel(level: FacilityLevel): string[] {
  const base = ["core", "registration", "opd", "clinical", "lab", "dispensing", "billing", "emergency"]
  if (
    level === "REGIONAL_REFERRAL_HOSPITAL" ||
    level === "NATIONAL_REFERRAL_HOSPITAL" ||
    level === "TEACHING_HOSPITAL"
  ) {
    return normalizeModuleKeys([
      ...base,
      "ipd",
      "radiology",
      "maternity",
      "theatre",
      "claims",
      "reports",
      "public_health",
      "migration",
    ])
  }
  if (level === "GENERAL_HOSPITAL") {
    return normalizeModuleKeys([...base, "ipd", "maternity", "claims", "reports"])
  }
  return normalizeModuleKeys(base)
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48)
}
