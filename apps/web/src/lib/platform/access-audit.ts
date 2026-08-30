import { supabaseAdmin } from "@synapse/db/admin";
import { logPlatformEvent } from "../../app/platform/_lib/platform-data";

export type PlatformAccessAuditAction =
  | "PLATFORM_MEMBER_INVITED"
  | "PLATFORM_MEMBER_INVITATION_RESENT"
  | "PLATFORM_MEMBER_INVITATION_REVOKED"
  | "PLATFORM_MEMBER_ACTIVATED"
  | "PLATFORM_MEMBER_ROLE_CHANGED"
  | "PLATFORM_MEMBER_SUSPENDED"
  | "PLATFORM_MEMBER_REACTIVATED"
  | "PLATFORM_MEMBER_REVOKED"
  | "PLATFORM_MEMBER_PASSWORD_RESET_REQUESTED"
  | "PLATFORM_MEMBER_TEMP_PASSWORD_ISSUED"
  | "PLATFORM_MEMBER_MFA_RESET"
  | "PLATFORM_MEMBER_SESSION_REVOKED";

export async function logPlatformAccessEvent(params: {
  actorId: string;
  actorRole: string;
  action: PlatformAccessAuditAction;
  targetUserId?: string | null;
  resourceId?: string | null;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  correlationId?: string;
}) {
  const correlationId = params.correlationId ?? crypto.randomUUID();
  const metadata = {
    reason: params.reason ?? null,
    before: params.before ?? null,
    after: params.after ?? null,
    correlation_id: correlationId,
    target_user_id: params.targetUserId ?? null,
  };

  await logPlatformEvent({
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    entityType: "platform_membership",
    entityId: params.resourceId ?? params.targetUserId ?? null,
    metadata,
  });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    await db.from("platform_audit_events").insert({
      actor_id: params.actorId,
      actor_role: params.actorRole,
      action: params.action,
      resource_type: "platform_membership",
      resource_id: params.resourceId ?? null,
      metadata,
      source: "platform_access",
    });
  } catch (error) {
    console.error("[platform-access-audit] platform_audit_events insert failed", error);
  }

  return correlationId;
}
