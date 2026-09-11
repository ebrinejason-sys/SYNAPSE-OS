export function canBindInviteToTenant(
  _profileTenantId: string | null,
  _activeScopeTenantIds: (string | null)[],
  inviteTenantId: string,
) {
  return Boolean(inviteTenantId);
}