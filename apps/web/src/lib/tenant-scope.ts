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
  if (profileTenantId && profileTenantId !== targetTenantId) return false;
  if (profileTenantId === targetTenantId) return true;
  if (assignments.some((assignment) => assignment.tenant_id && assignment.tenant_id !== targetTenantId)) return false;
  return assignments.some((assignment) => assignment.tenant_id === targetTenantId);
}