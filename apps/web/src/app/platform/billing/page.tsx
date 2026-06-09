export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "../../../lib/supabase/server";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { formatDate, formatUGX, logPlatformEvent, safeCount, safeRows } from "../_lib/platform-data";

type SubscriptionRow = {
  id?: string;
  tenant_id?: string | null;
  plan?: string | null;
  status?: string | null;
  monthly_amount_ugx?: number | string | null;
  billing_cycle_start?: string | null;
  billing_cycle_end?: string | null;
  last_payment_date?: string | null;
  next_billing_date?: string | null;
};

type TenantRow = {
  id?: string;
  name?: string | null;
  subscription_tier?: string | null;
  status?: string | null;
};

function statusClass(status: string | null | undefined) {
  if (status === "active") return "border-green-500/25 bg-green-500/10 text-green-300";
  if (status === "trial") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  if (status === "suspended" || status === "cancelled") return "border-red-500/25 bg-red-500/10 text-red-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

function nextMonthIsoDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

async function generateInvoice(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const subscriptionId = String(formData.get("subscription_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!subscriptionId || !tenantId) return;

  try {
    const supabaseAdmin = createServiceClient();
    await (supabaseAdmin as any).from("billing_invoices").insert({
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      amount_ugx: amount,
      status: "issued",
      due_date: nextMonthIsoDate(),
      created_by: profile.id,
      created_at: new Date().toISOString(),
    });
  } catch {}

  await logPlatformEvent({
    actorId: profile.id,
    action: "billing.invoice_generated",
    entityType: "facility_subscription",
    entityId: subscriptionId,
    tenantId,
    metadata: { amount_ugx: amount },
  });
  revalidatePath("/platform/billing");
}

async function markSubscriptionPaid(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const subscriptionId = String(formData.get("subscription_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!subscriptionId || !tenantId) return;

  const supabaseAdmin = createServiceClient();
  await (supabaseAdmin as any)
    .from("facility_subscriptions")
    .update({
      status: "active",
      last_payment_date: new Date().toISOString(),
      next_billing_date: nextMonthIsoDate(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  try {
    await (supabaseAdmin as any).from("billing_payments").insert({
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      amount_ugx: amount,
      method: "manual_admin",
      status: "paid",
      paid_at: new Date().toISOString(),
      recorded_by: profile.id,
    });
  } catch {}

  await logPlatformEvent({
    actorId: profile.id,
    action: "billing.payment_marked_paid",
    entityType: "facility_subscription",
    entityId: subscriptionId,
    tenantId,
    metadata: { amount_ugx: amount, method: "manual_admin" },
  });
  revalidatePath("/platform/billing");
}

async function changeSubscriptionPlan(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const subscriptionId = String(formData.get("subscription_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "");
  const plan = String(formData.get("plan") ?? "");
  const monthlyAmount = Number(formData.get("monthly_amount_ugx") ?? 0);
  const allowedPlans = new Set(["trial", "starter", "professional", "enterprise"]);
  if (!subscriptionId || !tenantId || !allowedPlans.has(plan)) return;

  const supabaseAdmin = createServiceClient();
  await (supabaseAdmin as any)
    .from("facility_subscriptions")
    .update({ plan, monthly_amount_ugx: monthlyAmount, status: plan === "trial" ? "trial" : "active", updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);
  await (supabaseAdmin as any).from("tenants").update({ subscription_tier: plan, status: plan === "trial" ? "trial" : "active" }).eq("id", tenantId);

  await logPlatformEvent({
    actorId: profile.id,
    action: "billing.plan_changed",
    entityType: "facility_subscription",
    entityId: subscriptionId,
    tenantId,
    metadata: { plan, monthly_amount_ugx: monthlyAmount },
  });
  revalidatePath("/platform/billing");
}

export default async function PlatformBillingPage() {
  await requirePlatformAdmin();

  const [subscriptions, tenants, trialFacilities] = await Promise.all([
    safeRows<SubscriptionRow>(
      "facility_subscriptions",
      "id, tenant_id, plan, status, monthly_amount_ugx, billing_cycle_start, billing_cycle_end, last_payment_date, next_billing_date",
      { orderBy: "next_billing_date", ascending: true, limit: 100 }
    ),
    safeRows<TenantRow>("tenants", "id, name, subscription_tier, status", { limit: 5000 }),
    safeCount("tenants", [["status", "trial"]]),
  ]);

  const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const activeSubscriptions = subscriptions.filter((row) => row.status === "active");
  const mrr = activeSubscriptions.reduce((sum, row) => sum + Number(row.monthly_amount_ugx ?? 0), 0);
  const arr = mrr * 12;
  const planCounts = subscriptions.reduce<Record<string, number>>((acc, row) => {
    const key = row.plan ?? tenantMap.get(row.tenant_id ?? "")?.subscription_tier ?? "unassigned";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Revenue Command</p>
        <h1 className="mt-2 text-2xl font-bold">Revenue + Billing</h1>
        <p className="mt-1 text-sm text-slate-400">Track subscriptions, overdue accounts, payment status, and plan performance.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["MRR", formatUGX(mrr)],
          ["ARR", formatUGX(arr)],
          ["Trial facilities", trialFacilities.toLocaleString()],
          ["Active subscriptions", activeSubscriptions.length.toLocaleString()],
          ["Plans configured", Object.keys(planCounts).length.toLocaleString()],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-bold text-[#F97316]">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <article className="rounded-xl border border-slate-800 bg-[#111117] p-4">
          <h2 className="text-sm font-semibold">Plan Mix</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(planCounts).length === 0 ? <p className="text-sm text-slate-500">No subscriptions yet.</p> : null}
            {Object.entries(planCounts).map(([plan, count]) => (
              <div key={plan}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="capitalize text-slate-300">{plan}</span>
                  <span className="text-slate-500">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-gradient-to-r from-[#F97316] to-[#E8B84B]" style={{ width: `${Math.min(100, count * 12)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-800 bg-[#111117]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
            <div>
              <h2 className="text-sm font-semibold">Subscriptions</h2>
              <p className="mt-1 text-xs text-slate-500">Invoices, manual payments, plan changes, and outstanding balances.</p>
            </div>
            <button type="button" className="rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-3 py-2 text-xs font-semibold text-[#E8B84B]">
              Export billing CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#07070A] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Monthly</th>
                  <th className="px-4 py-3">Next billing</th>
                  <th className="px-4 py-3">Last payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {subscriptions.map((subscription) => {
                  const tenant = tenantMap.get(subscription.tenant_id ?? "");
                  return (
                    <tr key={subscription.id ?? subscription.tenant_id ?? crypto.randomUUID()}>
                      <td className="px-4 py-3 font-medium text-slate-100">{tenant?.name ?? "Unknown facility"}</td>
                      <td className="px-4 py-3 capitalize text-slate-300">{subscription.plan ?? tenant?.subscription_tier ?? "unassigned"}</td>
                      <td className="px-4 py-3 text-slate-300">{formatUGX(Number(subscription.monthly_amount_ugx ?? 0))}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(subscription.next_billing_date)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(subscription.last_payment_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(subscription.status)}`}>
                          {subscription.status ?? "unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <form action={generateInvoice}>
                            <input type="hidden" name="subscription_id" value={subscription.id ?? ""} />
                            <input type="hidden" name="tenant_id" value={subscription.tenant_id ?? ""} />
                            <input type="hidden" name="amount" value={Number(subscription.monthly_amount_ugx ?? 0)} />
                            <button type="submit" className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">Invoice</button>
                          </form>
                          <form action={markSubscriptionPaid}>
                            <input type="hidden" name="subscription_id" value={subscription.id ?? ""} />
                            <input type="hidden" name="tenant_id" value={subscription.tenant_id ?? ""} />
                            <input type="hidden" name="amount" value={Number(subscription.monthly_amount_ugx ?? 0)} />
                            <button type="submit" className="rounded-lg border border-green-500/30 px-2 py-1 text-xs text-green-300">Mark paid</button>
                          </form>
                          <form action={changeSubscriptionPlan} className="flex flex-wrap gap-2">
                            <input type="hidden" name="subscription_id" value={subscription.id ?? ""} />
                            <input type="hidden" name="tenant_id" value={subscription.tenant_id ?? ""} />
                            <select name="plan" defaultValue={subscription.plan ?? tenant?.subscription_tier ?? "starter"} className="rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1 text-xs text-slate-300">
                              <option value="trial">trial</option>
                              <option value="starter">starter</option>
                              <option value="professional">professional</option>
                              <option value="enterprise">enterprise</option>
                            </select>
                            <input
                              name="monthly_amount_ugx"
                              type="number"
                              min="0"
                              step="1000"
                              defaultValue={Number(subscription.monthly_amount_ugx ?? 0)}
                              className="w-24 rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1 text-xs text-slate-300"
                            />
                            <button type="submit" className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">Save</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {subscriptions.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No subscription records yet. Add facility_subscriptions to activate billing automation.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
