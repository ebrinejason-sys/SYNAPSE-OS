export const dynamic = "force-dynamic";

import Link from "next/link";
import { createServiceClient } from "../../lib/supabase/server";
import { requirePlatformAdmin } from "../../lib/platform/auth";

type StatItem = {
  label: string;
  value: number;
};

async function getOverview() {
  const supabaseAdmin = createServiceClient();

  const stats = await Promise.all([
    (supabaseAdmin as any).from("tenants").select("id", { count: "exact", head: true }),
    (supabaseAdmin as any).from("profiles").select("id", { count: "exact", head: true }),
    (supabaseAdmin as any).from("patients").select("id", { count: "exact", head: true }),
    (supabaseAdmin as any).from("encounters").select("id", { count: "exact", head: true }),
    (supabaseAdmin as any)
      .from("beta_access_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    (supabaseAdmin as any)
      .from("verification_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
  ]);

  const { data: activity } = await (supabaseAdmin as any)
    .from("audit_log")
    .select("id, action, entity_type, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(10);

  const mrrValue = process.env.PLATFORM_MRR_UGX ?? "0";

  const supabaseHealth = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? "Configured"
    : "Missing env";

  const vercelHealth = process.env.VERCEL_TOKEN ? "Token configured" : "No Vercel token";

  const resendHealth = process.env.RESEND_API_KEY ? "Resend connected" : "No Resend key";

  return {
    statItems: [
      { label: "Total Hospitals", value: stats[0].count ?? 0 },
      { label: "Total Users", value: stats[1].count ?? 0 },
      { label: "Total Patients", value: stats[2].count ?? 0 },
      { label: "Total Encounters", value: stats[3].count ?? 0 },
      { label: "Pending Pilot Applications", value: stats[4].count ?? 0 },
      { label: "Pending Verifications", value: stats[5].count ?? 0 },
    ] as StatItem[],
    activity: (activity ?? []) as Array<{
      id: string;
      action: string;
      entity_type: string;
      created_at: string;
      actor_id: string;
    }>,
    mrrValue,
    systemHealth: [
      { label: "Supabase", value: supabaseHealth },
      { label: "Vercel", value: vercelHealth },
      { label: "Resend", value: resendHealth },
    ],
  };
}

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin();
  const data = await getOverview();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="mt-1 text-sm text-slate-400">Cross-tenant operational visibility for SynapseOS.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.statItems.map((item) => (
          <article key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-[#F97316]">{item.value.toLocaleString()}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-[#E8B84B]/30 bg-[#E8B84B]/8 p-4">
          <p className="text-xs uppercase tracking-wide text-[#E8B84B]">MRR (UGX)</p>
          <p className="mt-2 text-2xl font-semibold">{Number(data.mrrValue).toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-300">Manual placeholder until billing automation is enabled.</p>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">System Health</h2>
            <Link href="/platform/health" className="text-xs text-orange-300 hover:text-orange-200">
              Open detailed health view
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.systemHealth.map((entry) => (
              <div key={entry.label} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-500">{entry.label}</p>
                <p className="mt-1 text-sm text-slate-200">{entry.value}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Recent Activity</h2>
        <div className="space-y-2">
          {data.activity.length === 0 ? (
            <p className="text-sm text-slate-500">No recent entries in audit_log.</p>
          ) : null}
          {data.activity.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-slate-200">{entry.action}</p>
                <p className="text-xs text-slate-500">{entry.entity_type} · actor {entry.actor_id?.slice(0, 8) ?? "unknown"}</p>
              </div>
              <p className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
