export function isTenantScopeAllowed(
  profileTenantId: string | null,
  assignments: { tenant_id: string | null }[],
  targetTenantId: string,
  role: string | undefined,
  facilityType: string,
) {
  if (
    (role === "platform_admin" || role === "platform_observer" || role === "superadmin") &&
    facilityType !== "hospital"
  ) {
    return true;
  }
  if (profileTenantId === targetTenantId) return true;
  return assignments.some((assignment) => assignment.tenant_id === targetTenantId);
}