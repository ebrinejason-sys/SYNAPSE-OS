import { hashToken } from "@synapse/auth";
import { supabaseAdmin } from "@synapse/db/admin";
import {
  canManageTargetRole,
  isPlatformRole,
  MFA_MANDATORY_ROLES,
  roleHasCapability,
  type PlatformCapability,
  type PlatformMembershipStatus,
  type PlatformRole,
} from "./rbac";

export type PlatformMembership = {
  id: string;
  userId: string;
  platformRole: PlatformRole;
  status: PlatformMembershipStatus;
  invitedBy: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  expiresAt: string | null;
  lastAccessAt: string | null;
  mfaRequired: boolean;
  passwordChangeRequired: boolean;
  notes: string | null;
  metadata: Record<string, unknown>;
};

export type PlatformMemberProfile = {
  id: string;
  email: string;
  fullName: string | null;
  lastSignInAt: string | null;
  mustChangePassword: boolean;
};

export type PlatformMemberRow = PlatformMembership & {
  profile: PlatformMemberProfile;
  sessionCount: number;
  mfaEnrolled: boolean;
};

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const LEGACY_BOOTSTRAP_ENABLED = process.env.PLATFORM_LEGACY_ADMIN_EMAILS !== "false";

type MembershipRow = {
  id: string;
  user_id: string;
  platform_role: string;
  status: string;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  expires_at: string | null;
  last_access_at: string | null;
  mfa_required: boolean;
  password_change_required: boolean;
  notes: string | null;
  metadata: Record<string, unknown> | null;
};

function mapMembership(row: MembershipRow): PlatformMembership {
  return {
    id: row.id,
    userId: row.user_id,
    platformRole: row.platform_role as PlatformRole,
    status: row.status as PlatformMembershipStatus,
    invitedBy: row.invited_by,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    lastAccessAt: row.last_access_at,
    mfaRequired: row.mfa_required,
    passwordChangeRequired: row.password_change_required,
    notes: row.notes,
    metadata: row.metadata ?? {},
  };
}

function membershipIsUsable(m: PlatformMembership): boolean {
  if (m.status !== "ACTIVE") return false;
  if (m.expiresAt && new Date(m.expiresAt) < new Date()) return false;
  return true;
}

/** Load active platform membership for a user. Expires stale memberships. */
export async function getActivePlatformMembership(userId: string): Promise<PlatformMembership | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data } = await db
    .from("platform_memberships")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["ACTIVE", "SUSPENDED", "INVITED"])
    .maybeSingle();

  if (!data) return null;
  const membership = mapMembership(data as MembershipRow);

  if (
    membership.status === "ACTIVE" &&
    membership.expiresAt &&
    new Date(membership.expiresAt) < new Date()
  ) {
    await db
      .from("platform_memberships")
      .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
      .eq("id", membership.id);
    return null;
  }

  return membershipIsUsable(membership) ? membership : null;
}

/** Legacy bootstrap: platform_admin profile or ADMIN_EMAILS allow-list. */
export function legacyPlatformAccess(
  profileRole: string | null | undefined,
  email: string | null | undefined
): PlatformRole | null {
  if (profileRole === "platform_admin") return "PLATFORM_ADMIN";
  if (
    LEGACY_BOOTSTRAP_ENABLED &&
    email &&
    ADMIN_EMAILS.length > 0 &&
    ADMIN_EMAILS.includes(email.toLowerCase())
  ) {
    return "SUPER_ADMIN";
  }
  return null;
}

export async function resolvePlatformAccess(
  userId: string,
  profileRole: string | null | undefined,
  email: string | null | undefined
): Promise<{ role: PlatformRole; membership: PlatformMembership | null; legacy: boolean } | null> {
  const membership = await getActivePlatformMembership(userId);
  if (membership) {
    return { role: membership.platformRole, membership, legacy: false };
  }

  const legacyRole = legacyPlatformAccess(profileRole, email);
  if (legacyRole) {
    return { role: legacyRole, membership: null, legacy: true };
  }

  return null;
}

export function hasPlatformCapability(
  role: PlatformRole,
  capability: PlatformCapability
): boolean {
  return roleHasCapability(role, capability);
}

export async function touchPlatformAccess(userId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  await db
    .from("platform_memberships")
    .update({ last_access_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "ACTIVE");
}

export async function listPlatformMembers(): Promise<PlatformMemberRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data: memberships } = await db
    .from("platform_memberships")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!memberships?.length) return [];

  const userIds = memberships.map((m: MembershipRow) => m.user_id);
  const [{ data: profiles }, { data: sessions }, { data: mfaRows }] = await Promise.all([
    db.from("profiles").select("id, email, full_name, last_sign_in_at, must_change_password").in("id", userIds),
    db.from("synapse_sessions").select("user_id").in("user_id", userIds).is("revoked_at", null),
    db.from("mfa_enrollments").select("user_id, verified").in("user_id", userIds).eq("verified", true),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((p: PlatformMemberProfile) => [p.id, p])
  );
  const sessionCounts = new Map<string, number>();
  for (const s of sessions ?? []) {
    const uid = s.user_id as string;
    sessionCounts.set(uid, (sessionCounts.get(uid) ?? 0) + 1);
  }
  const mfaSet = new Set((mfaRows ?? []).map((r: { user_id: string }) => r.user_id));

  return memberships.map((row: MembershipRow) => {
    const membership = mapMembership(row);
    const profile = profileMap.get(membership.userId) ?? {
      id: membership.userId,
      email: "unknown",
      fullName: null,
      lastSignInAt: null,
      mustChangePassword: false,
    };
    return {
      ...membership,
      profile,
      sessionCount: sessionCounts.get(membership.userId) ?? 0,
      mfaEnrolled: mfaSet.has(membership.userId),
    };
  });
}

export async function getPlatformMember(userId: string): Promise<PlatformMemberRow | null> {
  const rows = await listPlatformMembers();
  return rows.find((r) => r.userId === userId) ?? null;
}

export function assertCanManageRole(actorRole: PlatformRole, targetRole: PlatformRole): void {
  if (!canManageTargetRole(actorRole, targetRole)) {
    throw new Error(`Not authorized to manage role ${targetRole}.`);
  }
}

export function platformRoleRequiresMfa(role: PlatformRole, membershipMfaRequired?: boolean): boolean {
  if (membershipMfaRequired === true) return true;
  return MFA_MANDATORY_ROLES.includes(role);
}

export function hashInviteToken(token: string): string {
  return hashToken(token);
}

export function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function validatePlatformRole(value: string): PlatformRole {
  if (!isPlatformRole(value)) {
    throw new Error(`Invalid platform role: ${value}`);
  }
  return value;
}

export async function ensureLegacyMembershipBootstrap(
  userId: string,
  profileRole: string | null | undefined,
  email: string | null | undefined
): Promise<void> {
  const legacyRole = legacyPlatformAccess(profileRole, email);
  if (!legacyRole) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data: existing } = await db
    .from("platform_memberships")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["INVITED", "ACTIVE", "SUSPENDED"])
    .maybeSingle();

  if (existing) return;

  await db.from("platform_memberships").insert({
    user_id: userId,
    platform_role: legacyRole,
    status: "ACTIVE",
    accepted_at: new Date().toISOString(),
    mfa_required: true,
    metadata: { source: "legacy_bootstrap" },
  });
}
