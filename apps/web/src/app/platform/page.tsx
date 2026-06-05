import { createServiceClient } from "../../lib/supabase/server";

async function getStats() {
  const supabase = createServiceClient();
  const [hospitals, profiles, patients, encounters, surveillance, imports, waitlist] =
    await Promise.all([
      (supabase as any).from("hospitals").select("id", { count: "exact", head: true }),
      (supabase as any).from("profiles").select("id", { count: "exact", head: true }),
      (supabase as any)
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("is_deleted", false),
      (supabase as any).from("encounters").select("id", { count: "exact", head: true }),
      (supabase as any).from("surveillance_reports").select("id", { count: "exact", head: true }),
      (supabase as any)
        .from("import_batches")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      (supabase as any).from("apk_waitlist").select("id", { count: "exact", head: true }),
    ]);
  return {
    hospitals: hospitals.count ?? 0,
    profiles: profiles.count ?? 0,
    patients: patients.count ?? 0,
    encounters: encounters.count ?? 0,
    surveillance: surveillance.count ?? 0,
    imports: imports.count ?? 0,
    waitlist: waitlist.count ?? 0,
  };
}

async function getHospitals() {
  const supabase = createServiceClient();
  const { data } = await (supabase as any)
    .from("hospitals")
    .select("id, name, subdomain, type, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as Array<{
    id: string;
    name: string;
    subdomain: string;
    type: string | null;
    created_at: string;
  }>;
}

async function getImportJobs() {
  const supabase = createServiceClient();
  const { data } = await (supabase as any)
    .from("import_batches")
    .select(
      "id, hospital_id, source_type, status, total_rows, valid_rows, error_rows, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as Array<{
    id: string;
    hospital_id: string;
    source_type: string;
    status: string;
    total_rows: number | null;
    valid_rows: number | null;
    error_rows: number | null;
    created_at: string;
  }>;
}

export default async function PlatformAdminPage() {
  const [stats, hospitals, jobs] = await Promise.all([
    getStats(),
    getHospitals(),
    getImportJobs(),
  ]);

  const STAT_ITEMS = [
    { label: "Hospitals", value: stats.hospitals, cls: "text-[#00D4AA]" },
    { label: "Staff", value: stats.profiles, cls: "text-indigo-500" },
    { label: "Patients", value: stats.patients, cls: "text-amber-400" },
    { label: "Encounters", value: stats.encounters, cls: "text-emerald-500" },
    { label: "Surveillance", value: stats.surveillance, cls: "text-red-500" },
    { label: "Imports Done", value: stats.imports, cls: "text-violet-500" },
    { label: "APK Waitlist", value: stats.waitlist, cls: "text-cyan-400" },
  ];

  return (
    <div className="min-h-screen bg-[#060D1A] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Platform Admin</h1>
          <p className="text-slate-400 text-sm mt-1">
            SynapseOS · qfqakzmjatszisuqjwon
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {STAT_ITEMS.map((s) => (
            <div key={s.label} className="bg-[#0D1B2E] border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.cls}`}>
                {s.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Hospitals table */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Hospitals
          </h2>
          <div className="bg-[#0D1B2E] border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-800">
                <tr>
                  {["Name", "Subdomain", "Type", "Registered"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {hospitals.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-white">{h.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#00D4AA]">{h.subdomain}</td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{h.type ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(h.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {hospitals.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      No hospitals yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Import Jobs table */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Import Jobs
          </h2>
          <div className="bg-[#0D1B2E] border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-800">
                <tr>
                  {["ID", "Source", "Status", "Total", "Valid", "Errors", "Date"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {j.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-slate-300">{j.source_type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          j.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : j.status === "failed"
                            ? "bg-red-500/15 text-red-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{j.total_rows ?? 0}</td>
                    <td className="px-4 py-3 text-emerald-400">{j.valid_rows ?? 0}</td>
                    <td className="px-4 py-3 text-red-400">{j.error_rows ?? 0}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(j.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      No import jobs yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
