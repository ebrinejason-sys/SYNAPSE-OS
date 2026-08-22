/**
 * Role + scope authorization. Belonging to a platform tenant is not enough
 * to see every facility, satellite, or department.
 */

export const FACILITY_MODES = [
  "NATIVE",
  "CONNECTED",
  "HYBRID",
  "SATELLITE",
  "COMMUNITY_ACCESS",
] as const

export type FacilityMode = (typeof FACILITY_MODES)[number]

export const SITE_KINDS = ["main", "satellite", "warehouse", "community_access", "branch"] as const
export type SiteKind = (typeof SITE_KINDS)[number]

export type ScopeAssignment = {
  profileId: string
  role: string
  organizationId?: string | null
  tenantId?: string | null
  siteId?: string | null
  departmentId?: string | null
  isActive?: boolean
}

export type ResourceScope = {
  organizationId?: string | null
  tenantId?: string | null
  siteId?: string | null
  departmentId?: string | null
}

export type ScopeSession = {
  profileId: string
  isPlatformAdmin?: boolean
  isOrgAdmin?: boolean
  assignments: ScopeAssignment[]
}

export function activeAssignments(session: ScopeSession): ScopeAssignment[] {
  return session.assignments.filter((a) => a.isActive !== false)
}

export function canAccessResource(session: ScopeSession, resource: ResourceScope): boolean {
  if (session.isPlatformAdmin) return true
  const grants = activeAssignments(session)
  if (grants.length === 0) {
    // Legacy sessions: a single-tenant JWT with no explicit assignment
    // may only access that tenant when the caller also supplies it as a grant
    // via assignments. Empty grants deny cross-facility access.
    return false
  }

  return grants.some((g) => assignmentCovers(g, resource, session.isOrgAdmin === true))
}

export function assignmentCovers(
  grant: ScopeAssignment,
  resource: ResourceScope,
  orgAdmin = false,
): boolean {
  if (grant.siteId) {
    return Boolean(resource.siteId && grant.siteId === resource.siteId)
  }
  if (grant.departmentId) {
    return Boolean(resource.departmentId && grant.departmentId === resource.departmentId)
  }
  if (grant.tenantId) {
    if (resource.tenantId !== grant.tenantId) return false
    // Tenant-wide grant covers all sites of that facility.
    return true
  }
  if (grant.organizationId) {
    if (resource.organizationId !== grant.organizationId) return false
    return orgAdmin || true
  }
  return false
}

export function visibleSiteIds(session: ScopeSession): string[] | "all-in-tenant" | "none" {
  if (session.isPlatformAdmin) return "all-in-tenant"
  const grants = activeAssignments(session)
  if (grants.some((g) => g.tenantId && !g.siteId && !g.departmentId)) return "all-in-tenant"
  if (grants.some((g) => g.organizationId && !g.tenantId && !g.siteId)) return "all-in-tenant"
  const sites = grants.map((g) => g.siteId).filter((id): id is string => Boolean(id))
  return sites.length > 0 ? sites : "none"
}

export function assertSiteAllowed(
  session: ScopeSession,
  siteId: string | null | undefined,
  tenantId: string,
): { ok: true } | { ok: false; reason: "NO_SITE_SCOPE" | "SITE_FORBIDDEN" } {
  const visible = visibleSiteIds(session)
  if (visible === "all-in-tenant") return { ok: true }
  if (visible === "none") return { ok: false, reason: "NO_SITE_SCOPE" }
  if (!siteId || !visible.includes(siteId)) return { ok: false, reason: "SITE_FORBIDDEN" }
  void tenantId
  return { ok: true }
}

export type FacilityContext = {
  organizationId?: string | null
  facilityId: string
  siteId?: string | null
  departmentId?: string | null
  facilityMode?: FacilityMode | null
}

export type FacilityRecord = {
  id: string
  organizationId?: string | null
  parentTenantId?: string | null
  facilityMode: FacilityMode
  siteKind?: SiteKind | null
}

export function isSatellite(facility: FacilityRecord): boolean {
  return facility.facilityMode === "SATELLITE" || facility.siteKind === "satellite"
}

export function parentCanAggregateChild(parent: FacilityRecord, child: FacilityRecord): boolean {
  if (parent.organizationId && child.organizationId === parent.organizationId) return true
  return child.parentTenantId === parent.id
}
