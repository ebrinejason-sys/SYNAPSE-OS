export const dynamic = "force-dynamic";

import { DatabaseZap, Play, RefreshCcw } from "lucide-react";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { formatDate, formatDateTime, safeRows } from "../_lib/platform-data";

type ExportRow = {
  id?: string;
  tenant_id?: string | null;
  export_date?: string | null;
  records_exported?: number | null;
  status?: string | null;
  error_message?: string | null;
  created_at?: string | null;
};

function statusClass(status: string | null | undefined) {
  if (status === "success") return "border-green-500/25 bg-green-500/10 text-green-300";
  if (status === "failed") return "border-red-500/25 bg-red-500/10 text-red-300";
  if (status === "partial") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

export default async function Dhis2ExportsPage() {
  await requirePlatformAdmin();
  const rows = await safeRows<ExportRow>(
    "dhis2_export_log",
    "id, tenant_id, export_date, records_exported, status, error_message, created_at",
    { orderBy: "export_date", limit: 120 }
  );
  const latest = rows[0];
  const failures = rows.filter((row) => row.status === "failed").length;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Ministry Reporting</p>
          <h1 className="mt-2 text-2xl font-bold">DHIS2 Export Monitor</h1>
          <p className="mt-1 text-sm text-slate-400">Monitor nightly exports, retry failed batches, and keep a reference mapping for DHIS2 fields.</p>
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-bold text-[#07070A]">
          <Play className="h-4 w-4" />
          Export all
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Last export", latest?.status ?? "none"],
          ["Records last run", Number(latest?.records_exported ?? 0).toLocaleString()],
          ["Failures", failures.toLocaleString()],
          ["Connection", process.env.DHIS2_URL ? "Configured" : "Pending env"],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-bold text-[#F97316]">{value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <article className="overflow-hidden rounded-xl border border-slate-800 bg-[#111117]">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-sm font-semibold">Export Log</h2>
            <p className="mt-1 text-xs text-slate-500">Latest DHIS2 batch events across facilities.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#07070A] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Facility/Tenant</th>
                  <th className="px-4 py-3">Records</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Error</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.id ?? row.created_at ?? crypto.randomUUID()}>
                    <td className="px-4 py-3 text-slate-300">{formatDate(row.export_date)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.tenant_id?.slice(0, 8) ?? "all"}</td>
                    <td className="px-4 py-3 text-slate-300">{Number(row.records_exported ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status ?? "pending"}</span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-500">{row.error_message ?? "None"}</td>
                    <td className="px-4 py-3">
                      <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">
                        <RefreshCcw className="h-3 w-3" />
                        Retry
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No DHIS2 export records yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <div className="mb-3 flex items-center gap-2">
              <DatabaseZap className="h-4 w-4 text-[#E8B84B]" />
              <h2 className="text-sm font-semibold">Schedule</h2>
            </div>
            <p className="text-sm text-slate-300">Nightly export window</p>
            <p className="mt-1 text-xs text-slate-500">02:00 Africa/Kampala</p>
            <p className="mt-3 text-sm text-slate-300">Last run</p>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(latest?.created_at ?? latest?.export_date)}</p>
          </section>

          <section className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <h2 className="text-sm font-semibold">Field Mapping Reference</h2>
            <div className="mt-3 space-y-2 text-xs">
              {[
                ["diagnoses.icd_code", "DHIS2 disease data element"],
                ["patients.district", "Org unit / district"],
                ["consultations.created_at", "Event date"],
                ["lab_results.status", "Result status"],
              ].map(([source, target]) => (
                <div key={source} className="rounded-lg border border-slate-800 bg-[#07070A] p-3">
                  <p className="font-mono text-[#E8B84B]">{source}</p>
                  <p className="mt-1 text-slate-500">{target}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
