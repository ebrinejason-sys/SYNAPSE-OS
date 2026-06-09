import { createServiceClient } from "../../../lib/supabase/server";

type QueryResult<T> = { data: T | null; count: number | null; error: { message?: string } | null };
type PlatformQuery = PromiseLike<QueryResult<unknown>> & {
  eq(column: string, value: unknown): PlatformQuery;
  order(column: string, options?: { ascending?: boolean }): PlatformQuery;
  limit(count: number): PlatformQuery;
};
type PlatformClient = {
  from(table: string): {
    select(columns?: string, options?: { count?: "exact"; head?: boolean }): PlatformQuery;
  };
};

export const FEATURE_KEYS = [
  "telemedicine_video",
  "insurance_copilot",
  "ai_clinical_assist",
  "pharmacy_network",
  "advanced_analytics",
  "wearable_sync",
  "dhis2_export",
  "sms_reminders",
] as const;

export function platformAdminClient() {
  return createServiceClient() as unknown as PlatformClient;
}

export async function logPlatformEvent({
  actorId,
  action,
  entityType,
  entityId,
  tenantId,
  metadata,
}: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    tenant_id: tenantId ?? null,
    metadata: metadata ?? {},
    created_at: new Date().toISOString(),
  };

  try {
    const supabaseAdmin = createServiceClient();
    const { error } = await (supabaseAdmin as any).from("audit_logs").insert(payload);
    if (!error) return;
  } catch {}

  try {
    const supabaseAdmin = createServiceClient();
    await (supabaseAdmin as any).from("audit_log").insert(payload);
  } catch {}
}

export async function safeCount(table: string, filters: Array<[string, unknown]> = []) {
  try {
    let query = platformAdminClient().from(table).select("id", { count: "exact", head: true });
    for (const [column, value] of filters) {
      query = query.eq(column, value);
    }
    const result = (await query) as QueryResult<null>;
    return result.error ? 0 : result.count ?? 0;
  } catch {
    return 0;
  }
}

export async function safeRows<T extends Record<string, unknown>>(
  table: string,
  columns = "*",
  options: { orderBy?: string; ascending?: boolean; limit?: number; filters?: Array<[string, unknown]> } = {}
) {
  try {
    let query = platformAdminClient().from(table).select(columns);
    for (const [column, value] of options.filters ?? []) {
      query = query.eq(column, value);
    }
    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending ?? false });
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    const result = (await query) as QueryResult<T[]>;
    return result.error ? [] : result.data ?? [];
  } catch {
    return [];
  }
}

export function formatUGX(value: number) {
  return `UGX ${Math.round(value).toLocaleString("en-UG")}`;
}

export function formatDate(value: unknown) {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", { timeZone: "Africa/Kampala" });
}

export function formatDateTime(value: unknown) {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString("en-GB", { timeZone: "Africa/Kampala" });
}
