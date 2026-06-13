export const dynamic = "force-dynamic";

import { Download, FileSearch, LockKeyhole, Search } from "lucide-react";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { formatDateTime, safeRows } from "../_lib/platform-data";

type AuditRow = {
  id?: string;
  action?: string | null;
  event?: string | null;
  entity_type?: string | null;
  resource_type?: string | null;
  entity_id?: string | null;
  resource_id?: string | null;
  actor_id?: string | null;
  tenant_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
  changes?: Record<string, unknown> | null;
  created_at?: string | null;
};

type ProfileRow = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

type TenantRow = {
  id?: string;
  name?: string | null;
};

function categoryClass(action: string) {
  if (action.includes("auth") || action.includes("login")) return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  if (action.includes("billing") || action.includes("invoice")) return "border-green-500/25 bg-green-500/10 text-green-300";
  if (action.includes("feature") || action.includes("admin")) return "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]";
  if (action.includes("delete") || action.includes("suspend")) return "border-red-500/25 bg-red-500/10 text-red-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

export default async function PlatformAuditLogPage() {
  await requirePlatformAdmin();

  let logs = await safeRows<AuditRow>(
    "audit_logs",
    "id, action, entity_type, entity_id, actor_id, tenant_id, ip_address, user_agent, metadata, changes, created_at",
    { orderBy: "created_at", limit: 120 }
  );
  if (logs.length === 0) {
    logs = await safeRows<AuditRow>("audit_log", "id, action, entity_type, entity_id, actor_id, tenant_id, ip_address, user_agent, metadata, changes, created_at", {
      orderBy: "created_at",
      limit: 120,
    });
  }

  const [profiles, tenants] = await Promise.all([
    safeRows<ProfileRow>("profiles", "id, full_name, email, role", { limit: 5000 }),
    safeRows<TenantRow>("tenants", "id, name", { limit: 5000 }),
  ]);

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const criticalEvents = logs.filter((log) => String(log.action ?? log.event ?? "").match(/delete|suspend|impersonat|failed/i)).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Compliance Ledger</p>
          <h1 className="mt-2 text-2xl font-bold">Audit Log</h1>
          <p className="mt-1 text-sm text-slate-400">
            Immutable platform activity for auth, clinical, pharmacy, billing, admin, support, and system events.
          </p>
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-4 py-2 text-sm font-semibold text-[#E8B84B]">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Events loaded", logs.length],
          ["Known actors", profileMap.size],
          ["Known facilities", tenantMap.size],
          ["Critical events", criticalEvents],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[#F97316]">{Number(value).toLocaleString()}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <article className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[#E8B84B]" />
              <h2 className="text-sm font-semibold">Filters</h2>
            </div>
            <div className="mt-4 space-y-3">
              {["Facility", "Actor", "Action category", "Date/time range", "Resource type"].map((filter) => (
                <div key={filter} className="rounded-lg border border-slate-800 bg-[#07070A] px-3 py-2 text-sm text-slate-400">
                  {filter}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-[#E8B84B]" />
              <h2 className="text-sm font-semibold">Immutability</h2>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              This page is read-only. Update/delete controls are intentionally absent for compliance investigations.
            </p>
          </article>
        </aside>

        <article className="overflow-hidden rounded-xl border border-slate-800 bg-[#111117]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-[#E8B84B]" />
              <div>
                <h2 className="text-sm font-semibold">Recent Activity</h2>
                <p className="mt-1 text-xs text-slate-500">Showing the latest 120 events in Uganda local time.</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#07070A] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3">IP / Agent</th>
                  <th className="px-4 py-3">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.map((log) => {
                  const action = String(log.action ?? log.event ?? "system.event");
                  const actor = profileMap.get(log.actor_id ?? "");
                  const tenant = tenantMap.get(log.tenant_id ?? "");
                  return (
                    <tr key={log.id ?? `${action}:${log.created_at}`} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-100">{actor?.full_name ?? actor?.email ?? "System"}</p>
                        <p className="mt-1 text-xs text-slate-500">{actor?.role ?? log.actor_id?.slice(0, 8) ?? "system"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${categoryClass(action)}`}>{action}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-300">{log.entity_type ?? log.resource_type ?? "resource"}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{log.entity_id ?? log.resource_id ?? "n/a"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{tenant?.name ?? "Platform"}</td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-slate-400">{log.ip_address ?? "not captured"}</p>
                        <p className="mt-1 max-w-52 truncate text-xs text-slate-500">{log.user_agent ?? "agent not captured"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <details>
                          <summary className="cursor-pointer text-xs text-[#E8B84B]">JSON diff</summary>
                          <pre className="mt-2 max-h-40 max-w-80 overflow-auto rounded-lg border border-slate-800 bg-[#07070A] p-2 text-xs text-slate-400">
                            {JSON.stringify(log.changes ?? log.metadata ?? {}, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  );
                })}
                {logs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No audit events found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
