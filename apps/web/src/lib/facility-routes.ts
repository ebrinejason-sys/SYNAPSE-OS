/**
 * Canonical facility-scoped production routes.
 * Competing /doctor /nurse /dept /admin surfaces must map here.
 */

export const FACILITY_SHELL = "/os/[slug]" as const

export const CANONICAL_FACILITY_ROUTES = {
  dashboard: "/os/[slug]/dashboard",
  patients: "/os/[slug]/patients",
  receptionEncounter: "/os/[slug]/encounters/new",
  doctorWorkspace: "/os/[slug]/clinical/queue",
  doctorOrders: "/os/[slug]/clinical/orders",
  nursingWorkspace: "/os/[slug]/clinical/nursing",
  tasks: "/os/[slug]/clinical/tasks",
  dispense: "/os/[slug]/clinical/dispense",
  hospitalAdmin: "/hospital/admin",
  labWorklist: "/lab/orders",
  pharmacyQueue: "/pharmacy/queue",
  encounterHub: "/encounter/[id]",
  encounterNotes: "/encounter/[id]/notes",
  encounterSign: "/encounter/[id]/sign",
  encounterDisposition: "/encounter/[id]/disposition",
  referrals: "/referrals",
} as const

export type LegacyFacilityRoute =
  | "/admin"
  | "/admin/lab"
  | "/admin/supply/orders"
  | "/doctor"
  | "/doctor/queue"
  | "/doctor/orders"
  | "/nurse"
  | "/nurse/queue"
  | "/consults"
  | "/encounter/new"
  | "/dept/opd/queue"
  | "/lab/reports"

export const LEGACY_TO_CANONICAL: Record<string, string> = {
  "/admin": "/hospital/admin",
  "/admin/lab": "/lab/orders",
  "/admin/supply/orders": "/admin/supply",
  "/admin/settings/branding": "/hospital/admin/settings",
  "/admin/settings/domain": "/hospital/admin/settings",
  "/admin/settings/guidelines": "/hospital/admin/settings",
  "/doctor": "/os/[slug]/clinical/queue",
  "/doctor/queue": "/os/[slug]/clinical/queue",
  "/doctor/orders": "/os/[slug]/clinical/orders",
  "/doctor/ai": "/doctor",
  "/doctor/consults": "/doctor",
  "/doctor/notes": "/doctor",
  "/doctor/referrals": "/referrals",
  "/doctor/reports": "/os/[slug]/clinical/orders",
  "/doctor/rounds": "/doctor",
  "/doctor/schedule": "/doctor",
  "/doctor/tele": "/tele/book",
  "/nurse": "/os/[slug]/clinical/nursing",
  "/nurse/queue": "/os/[slug]/clinical/nursing",
  "/nurse/beds": "/nurse",
  "/nurse/handover": "/nurse",
  "/nurse/mar": "/nurse",
  "/nurse/observations": "/nurse",
  "/nurse/procedures": "/nurse",
  "/consults": "/doctor",
  "/consults/new": "/doctor",
  "/encounter/new": "/os/[slug]/encounters/new",
  "/encounter/[id]/orders": "/os/[slug]/clinical/orders",
  "/dept/opd/queue": "/os/[slug]/clinical/queue",
  "/lab/reports": "/lab/results",
  "/lab/qc": "/lab/verify",
  "/referrals/incoming": "/referrals",
  "/referrals/outgoing": "/referrals",
}

export function materializeFacilityPath(template: string, slug: string, extra: Record<string, string> = {}): string {
  return template
    .replaceAll("[slug]", encodeURIComponent(slug))
    .replaceAll("[id]", encodeURIComponent(extra.id ?? extra.encounterId ?? ""))
}

export function doctorLandingPath(slug?: string | null): string {
  return slug ? `/os/${encodeURIComponent(slug)}/clinical/queue` : "/doctor"
}

export function nursingLandingPath(slug?: string | null): string {
  return slug ? `/os/${encodeURIComponent(slug)}/clinical/nursing` : "/nurse"
}

export function receptionLandingPath(slug?: string | null): string {
  return slug ? `/os/${encodeURIComponent(slug)}/patients` : "/os"
}

export function hospitalAdminLandingPath(): string {
  return "/hospital/admin"
}
