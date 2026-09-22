/** Control-plane roles for admin.synapseos.tech governance portal. */
export const PLATFORM_ROLES = [
  "SUPER_ADMIN",
  "PLATFORM_ADMIN",
  "RELEASE_MANAGER",
  "SECURITY_ADMIN",
  "FINANCE_ADMIN",
  "SUPPORT_ADMIN",
  "CLINICAL_GOVERNANCE",
  "STAKEHOLDER",
  "BOARD_OBSERVER",
  "INVESTOR_OBSERVER",
  "TECHNICAL_OBSERVER",
  "AUDITOR",
  "READ_ONLY_OBSERVER",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export type PlatformMembershipStatus =
  | "INVITED"
  | "ACTIVE"
  | "SUSPENDED"
  | "REVOKED"
  | "EXPIRED";

/** Fine-grained control-plane capabilities. */
export const PLATFORM_CAPABILITIES = [
  "platform.dashboard.read",
  "product.read",
  "capability.read",
  "test_center.read",
  "simulation.read",
  "simulation.manage",
  "deployment.read",
  "release.read",
  "integration.read",
  "event.read",
  "incident.read",
  "analytics.read",
  "finance_summary.read",
  "security_summary.read",
  "audit.read",
  "user.read",
  "user.invite",
  "user.role.manage",
  "user.suspend",
  "user.reactivate",
  "user.session.revoke",
  "user.password_reset",
  "user.mfa.manage",
  "deployment.manage",
  "release.manage",
  "integration.manage",
  "feature_flag.manage",
  "incident.manage",
  "tenant.manage",
  "platform.subscription.read",
  "platform.subscription.manage",
  "platform.pricing.read",
  "platform.pricing.manage",
  "platform.crm.read",
  "platform.crm.manage",
] as const;

export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number];

const ALL_READ: PlatformCapability[] = [
  "platform.dashboard.read",
  "product.read",
  "capability.read",
  "test_center.read",
  "simulation.read",
  "deployment.read",
  "release.read",
  "integration.read",
  "event.read",
  "incident.read",
  "analytics.read",
  "audit.read",
];

const OBSERVER_READ: PlatformCapability[] = [
  ...ALL_READ,
  "security_summary.read",
];

const ROLE_CAPABILITIES: Record<PlatformRole, PlatformCapability[]> = {
  SUPER_ADMIN: [...PLATFORM_CAPABILITIES],
  PLATFORM_ADMIN: [
    ...ALL_READ,
    "simulation.manage",
    "finance_summary.read",
    "security_summary.read",
    "user.read",
    "user.invite",
    "user.role.manage",
    "user.suspend",
    "user.reactivate",
    "user.session.revoke",
    "user.password_reset",
    "user.mfa.manage",
    "deployment.manage",
    "release.manage",
    "integration.manage",
    "feature_flag.manage",
    "incident.manage",
    "tenant.manage",
    "platform.subscription.read",
    "platform.subscription.manage",
    "platform.pricing.read",
    "platform.pricing.manage",
    "platform.crm.read",
    "platform.crm.manage",
  ],
  RELEASE_MANAGER: [
    ...ALL_READ,
    "deployment.read",
    "release.read",
    "deployment.manage",
    "release.manage",
    "incident.read",
    "incident.manage",
  ],
  SECURITY_ADMIN: [
    ...ALL_READ,
    "security_summary.read",
    "audit.read",
    "user.read",
    "user.session.revoke",
    "user.mfa.manage",
    "incident.manage",
  ],
  FINANCE_ADMIN: [
    "platform.dashboard.read",
    "product.read",
    "analytics.read",
    "finance_summary.read",
    "audit.read",
    "platform.pricing.read",
    "platform.pricing.manage",
    "platform.crm.read",
    "platform.subscription.read",
  ],
  SUPPORT_ADMIN: [
    "platform.dashboard.read",
    "product.read",
    "test_center.read",
    "incident.read",
    "user.read",
    "user.password_reset",
    "platform.crm.read",
  ],
  CLINICAL_GOVERNANCE: [
    ...OBSERVER_READ,
    "test_center.read",
    "simulation.read",
    "simulation.manage",
  ],
  STAKEHOLDER: OBSERVER_READ,
  BOARD_OBSERVER: OBSERVER_READ,
  INVESTOR_OBSERVER: [
    "platform.dashboard.read",
    "product.read",
    "analytics.read",
    "finance_summary.read",
    "deployment.read",
    "release.read",
    "incident.read",
    "test_center.read",
  ],
  TECHNICAL_OBSERVER: [
    ...OBSERVER_READ,
    "simulation.read",
    "integration.read",
    "event.read",
  ],
  AUDITOR: [
    ...OBSERVER_READ,
    "finance_summary.read",
    "security_summary.read",
  ],
  READ_ONLY_OBSERVER: OBSERVER_READ,
};

/** Roles that must enroll MFA before platform access. */
export const MFA_MANDATORY_ROLES: PlatformRole[] = [
  "SUPER_ADMIN",
  "PLATFORM_ADMIN",
  "SECURITY_ADMIN",
  "RELEASE_MANAGER",
];

export const OBSERVER_ROLES: PlatformRole[] = [
  "STAKEHOLDER",
  "BOARD_OBSERVER",
  "INVESTOR_OBSERVER",
  "TECHNICAL_OBSERVER",
  "AUDITOR",
  "READ_ONLY_OBSERVER",
];

export const ADMIN_ROLES: PlatformRole[] = [
  "SUPER_ADMIN",
  "PLATFORM_ADMIN",
  "RELEASE_MANAGER",
  "SECURITY_ADMIN",
  "FINANCE_ADMIN",
  "SUPPORT_ADMIN",
  "CLINICAL_GOVERNANCE",
];

export function isPlatformRole(value: string): value is PlatformRole {
  return (PLATFORM_ROLES as readonly string[]).includes(value);
}

export function roleCapabilities(role: PlatformRole): PlatformCapability[] {
  return ROLE_CAPABILITIES[role] ?? [];
}

export function roleHasCapability(role: PlatformRole, capability: PlatformCapability): boolean {
  return roleCapabilities(role).includes(capability);
}

/** Which roles an actor may assign or manage. */
export function manageableRoles(actorRole: PlatformRole): PlatformRole[] {
  if (actorRole === "SUPER_ADMIN") return [...PLATFORM_ROLES];
  if (actorRole === "PLATFORM_ADMIN") {
    return PLATFORM_ROLES.filter((r) => r !== "SUPER_ADMIN");
  }
  if (actorRole === "SECURITY_ADMIN") {
    return OBSERVER_ROLES;
  }
  return [];
}

export function canManageTargetRole(actorRole: PlatformRole, targetRole: PlatformRole): boolean {
  return manageableRoles(actorRole).includes(targetRole);
}

export function canResetPasswordFor(actorRole: PlatformRole, targetRole: PlatformRole): boolean {
  if (!roleHasCapability(actorRole, "user.password_reset")) return false;
  return canManageTargetRole(actorRole, targetRole);
}

export function isObserverRole(role: PlatformRole): boolean {
  return OBSERVER_ROLES.includes(role);
}

export function roleLabel(role: PlatformRole): string {
  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function statusLabel(status: PlatformMembershipStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/** Nav paths visible per capability (server-side filter). */
export const NAV_CAPABILITY_MAP: Record<string, PlatformCapability> = {
  "/platform": "platform.dashboard.read",
  "/platform/performance": "platform.dashboard.read",
  "/platform/test-center": "test_center.read",
  "/platform/registry": "product.read",
  "/platform/monitoring": "platform.dashboard.read",
  "/platform/simulation": "simulation.read",
  "/platform/events": "event.read",
  "/platform/lab": "product.read",
  "/platform/intelligence": "analytics.read",
  "/platform/icd11": "product.read",
  "/platform/modules": "capability.read",
  "/platform/integrations": "integration.read",
  "/platform/incidents": "incident.read",
  "/platform/applications": "tenant.manage",
  "/platform/approvals": "tenant.manage",
  "/platform/sales": "platform.crm.read",
  "/platform/commercial/leads": "platform.crm.read",
  "/platform/commercial/meetings": "platform.crm.read",
  "/platform/commercial/pricing": "platform.pricing.read",
  "/platform/commercial/subscriptions": "platform.subscription.read",
  "/platform/hospitals": "tenant.manage",
  "/platform/facilities": "tenant.manage",
  "/platform/users": "user.read",
  "/platform/access": "user.read",
  "/platform/pharmacy-network": "tenant.manage",
  "/platform/support": "tenant.manage",
  "/platform/broadcasts": "tenant.manage",
  "/platform/billing": "finance_summary.read",
  "/platform/receipts": "finance_summary.read",
  "/platform/subscriptions": "platform.subscription.read",
  "/platform/analytics": "analytics.read",
  "/platform/public-health": "analytics.read",
  "/platform/security": "security_summary.read",
  "/platform/audit-log": "audit.read",
  "/platform/flags": "feature_flag.manage",
  "/platform/dhis2": "tenant.manage",
  "/platform/database": "tenant.manage",
  "/platform/deployments": "deployment.read",
  "/platform/mobile": "deployment.read",
  "/platform/health": "platform.dashboard.read",
  "/platform/settings": "platform.dashboard.read",
};

export function navRequiresCapability(href: string): PlatformCapability | null {
  const exact = NAV_CAPABILITY_MAP[href];
  if (exact) return exact;
  for (const [path, cap] of Object.entries(NAV_CAPABILITY_MAP)) {
    if (href.startsWith(`${path}/`)) return cap;
  }
  return "platform.dashboard.read";
}
