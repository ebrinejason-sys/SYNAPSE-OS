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

/**
 * Append a platform-admin action to the immutable `audit_log` ledger.
 *
 * IMPORTANT: the live `audit_log` table uses the columns
 * (table_name, action, record_id, user_id, user_role, old_value, new_value,
 * tenant_id, created_at) — NOT (actor_id, entity_type, entity_id, metadata).
 * Keep this mapping in sync with the DB or events silently disappear.
 */
export async function logPlatformEvent({
  actorId,
  action,
  entityType,
  entityId,
  tenantId,
  metadata,
  oldValue,
  actorRole = "platform_admin",
}: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
  oldValue?: Record<string, unknown> | null;
  actorRole?: string;
}) {
  const payload = {
    table_name: entityType,
    action,
    record_id: entityId ?? null,
    user_id: actorId,
    user_role: actorRole,
    old_value: oldValue ?? null,
    new_value: metadata ?? {},
    tenant_id: tenantId ?? null,
    created_by: actorId,
    created_at: new Date().toISOString(),
  };

  try {
    const supabaseAdmin = createServiceClient();
    const { error } = await (supabaseAdmin as any).from("audit_log").insert(payload);
    if (error) console.error("logPlatformEvent failed:", error.message);
  } catch (err) {
    console.error("logPlatformEvent threw:", err);
  }
}

/**
 * Record a subscription state transition in `subscription_events` (the billing
 * state-machine audit). Prefers the SECURITY DEFINER RPC `log_subscription_event`
 * and falls back to a direct insert.
 */
export async function logSubscriptionEvent({
  tenantId,
  fromStatus,
  toStatus,
  reason,
  actor,
  metadata,
}: {
  tenantId: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  actor?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!tenantId) return;
  try {
    const supabaseAdmin = createServiceClient() as any;
    const { error } = await supabaseAdmin.rpc("log_subscription_event", {
      p_tenant_id: tenantId,
      p_from_status: fromStatus ?? null,
      p_to_status: toStatus ?? null,
      p_reason: reason ?? null,
      p_actor: actor ?? "platform_admin",
      p_metadata: metadata ?? {},
    });
    if (error) {
      await supabaseAdmin.from("subscription_events").insert({
        tenant_id: tenantId,
        from_status: fromStatus ?? null,
        to_status: toStatus ?? null,
        reason: reason ?? null,
        actor: actor ?? "platform_admin",
        metadata: metadata ?? {},
      });
    }
  } catch (err) {
    console.error("logSubscriptionEvent failed:", err);
  }
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

/**
 * Like safeCount, but distinguishes missing tables from empty tables.
 * Missing / misconfigured → `{ status: "NOT_CONFIGURED", count: null }`.
 * Present (even with 0 rows) → `{ status: "OK", count: number }`.
 */
export async function safeConfiguredCount(
  table: string,
  filters: Array<[string, unknown]> = [],
): Promise<{ status: "OK" | "NOT_CONFIGURED"; count: number | null; detail?: string }> {
  try {
    let query = platformAdminClient().from(table).select("id", { count: "exact", head: true });
    for (const [column, value] of filters) {
      query = query.eq(column, value);
    }
    const result = (await query) as QueryResult<null>;
    if (result.error) {
      const message = result.error.message ?? "query_failed";
      const missing =
        /does not exist|Could not find the table|schema cache|PGRST205|42P01/i.test(message) ||
        /relation .* does not exist/i.test(message);
      if (missing) {
        return { status: "NOT_CONFIGURED", count: null, detail: message };
      }
      return { status: "NOT_CONFIGURED", count: null, detail: message };
    }
    return { status: "OK", count: result.count ?? 0 };
  } catch (err) {
    return {
      status: "NOT_CONFIGURED",
      count: null,
      detail: err instanceof Error ? err.message : "unreachable",
    };
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

export function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function lastNDays(n: number) {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

export function dailyCountsFromRows(rows: Array<{ created_at?: string | null }>, days = 14) {
  const keys = lastNDays(days);
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const row of rows) {
    if (!row.created_at) continue;
    const key = dayKey(new Date(row.created_at));
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((key) => counts.get(key) ?? 0);
}

export function percentDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export type PlanRow = {
  id?: string;
  slug?: string | null;
  name?: string | null;
  facility_type?: string | null;
  price_usd?: number | string | null;
  price_ugx?: number | string | null;
  billing_cycle?: string | null;
  is_active?: boolean | null;
};

export type TenantSubscriptionRow = {
  id?: string;
  tenant_id?: string | null;
  plan_id?: string | null;
  status?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  grace_until?: string | null;
  trial_ends?: string | null;
  last_payment_at?: string | null;
  cancel_at_period_end?: boolean | null;
  created_at?: string | null;
};

// Statuses considered "paying" for MRR. trial/trialing/past_due are excluded
// from realised revenue but counted separately.
export const MRR_STATUSES = new Set(["active"]);

/** Monthly value of a plan in UGX — quarterly and yearly prices are normalized
 * (÷3, ÷12) so MRR is comparable across billing cycles. */
export function monthlyValueUGX(plan: PlanRow | null | undefined) {
  const price = Number(plan?.price_ugx ?? 0);
  if (!price || Number.isNaN(price)) return 0;
  const cycle = (plan?.billing_cycle ?? "monthly").toLowerCase();
  if (cycle === "quarterly") return price / 3;
  if (cycle === "yearly" || cycle === "annual" || cycle === "annually") return price / 12;
  return price;
}

/**
 * Load all tenant_subscriptions joined with their plan, returning a plan lookup
 * map and the computed monthly recurring revenue (UGX) from active subs.
 */
export async function loadSubscriptionData() {
  const [subscriptions, plans] = await Promise.all([
    safeRows<TenantSubscriptionRow>(
      "tenant_subscriptions",
      "id, tenant_id, plan_id, status, current_period_start, current_period_end, grace_until, trial_ends, last_payment_at, cancel_at_period_end, created_at",
      { orderBy: "current_period_end", ascending: true, limit: 5000 }
    ),
    safeRows<PlanRow>(
      "subscription_plans",
      "id, slug, name, facility_type, price_usd, price_ugx, billing_cycle, is_active",
      { limit: 200 }
    ),
  ]);

  const planMap = new Map(plans.map((plan) => [plan.id, plan]));
  const mrr = subscriptions
    .filter((sub) => MRR_STATUSES.has(sub.status ?? ""))
    .reduce((sum, sub) => sum + monthlyValueUGX(planMap.get(sub.plan_id ?? "")), 0);

  const counts = subscriptions.reduce<Record<string, number>>((acc, sub) => {
    const key = sub.status ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return { subscriptions, plans, planMap, mrr, counts };
}

export function subscriptionStatusClass(status: string | null | undefined) {
  if (status === "active") return "border-green-500/25 bg-green-500/10 text-green-300";
  if (status === "trial" || status === "trialing")
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  if (status === "past_due") return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  if (status === "suspended" || status === "cancelled" || status === "canceled")
    return "border-red-500/25 bg-red-500/10 text-red-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

export async function checkDatabaseLatency() {
  const started = Date.now();
  try {
    const result = await platformAdminClient().from("tenants").select("id", { count: "exact", head: true });
    const latencyMs = Date.now() - started;
    const ok = !result.error;
    return { ok, latencyMs };
  } catch {
    return { ok: false, latencyMs: Date.now() - started };
  }
}
