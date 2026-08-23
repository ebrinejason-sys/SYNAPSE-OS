/**
 * Canonical future pharmacy audit contract.
 * Historical writers may still target pharmacy_audit_logs / audit_log /
 * audit_events / platform_audit_events. New high-risk writes should use
 * this shape and pharmacy_audit_logs until consolidation is complete.
 */

export const PHARMACY_AUDIT_ACTIONS = [
  "LOGIN",
  "SALE",
  "REFUND",
  "VOID",
  "STOCK_RECEIVE",
  "STOCK_ADJUST",
  "TRANSFER_SHIP",
  "TRANSFER_RECEIVE",
  "PRICE_OVERRIDE",
  "DISCOUNT_OVERRIDE",
  "TILL_OPEN",
  "TILL_CLOSE",
  "PERMISSION_CHANGE",
] as const

export type PharmacyAuditAction = (typeof PHARMACY_AUDIT_ACTIONS)[number]

export type PharmacyAuditEvent = {
  action: PharmacyAuditAction | string
  tenantId: string
  storeId?: string | null
  actorId: string
  deviceId?: string | null
  sessionId?: string | null
  correlationId?: string | null
  entity: string
  entityId: string
  reason?: string | null
  result: "ok" | "denied" | "failed"
  details?: Record<string, unknown>
  at?: string
}

/** Map historical table names to the future contract. Do not drop history. */
export const AUDIT_TABLE_COMPAT = {
  canonicalWrite: "pharmacy_audit_logs",
  historical: ["audit_events", "audit_log", "platform_audit_events"] as const,
} as const

export function toPharmacyAuditInsert(event: PharmacyAuditEvent) {
  return {
    tenant_id: event.tenantId,
    profile_id: event.actorId,
    action: event.action,
    entity: event.entity,
    entity_id: event.entityId,
    details: JSON.stringify({
      storeId: event.storeId ?? null,
      deviceId: event.deviceId ?? null,
      sessionId: event.sessionId ?? null,
      correlationId: event.correlationId ?? null,
      reason: event.reason ?? null,
      result: event.result,
      ...(event.details ?? {}),
    }),
  }
}
