export function canBindInviteToTenant(
  profileTenantId: string | null,
  activeScopeTenantIds: (string | null)[],
  inviteTenantId: string,
) {
  if (profileTenantId && profileTenantId !== inviteTenantId) return false;
  return activeScopeTenantIds.every((tenantId) => !tenantId || tenantId === inviteTenantId);
}