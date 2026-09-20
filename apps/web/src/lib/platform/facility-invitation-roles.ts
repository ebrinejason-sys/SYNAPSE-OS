/**
 * Input aliases that may appear on invitation/admin forms.
 * Persistence and `profiles.role` CHECK use the canonical vocabulary only.
 */
const FACILITY_INVITATION_ROLE_ALIASES: Record<string, string> = {
  lab_tech: "lab_technician",
}

/** Maps invitation/UI aliases onto the canonical `profiles.role` CHECK vocabulary. */
export function normalizeFacilityInvitationRole(role: string): string {
  const trimmed = role.trim()
  return FACILITY_INVITATION_ROLE_ALIASES[trimmed] ?? trimmed
}
