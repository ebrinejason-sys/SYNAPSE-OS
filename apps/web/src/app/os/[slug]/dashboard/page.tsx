import { createClient } from "../../../../lib/supabase/server";
import { headers } from "next/headers";
import { resolveTenant } from "../../../../lib/tenant";
import Link from "next/link";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hdrs = await headers();
  const subdomain = hdrs.get("x-hospital-subdomain") ?? slug;
  const tenant = await resolveTenant(subdomain);
  if (!tenant) return <div className="p-8 text-red-400">Tenant not found</div>;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [patientRes, encounterRes] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.tenantId)
      .eq("is_deleted", false),
    supabase
      .from("encounters")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.tenantId),
  ]);

  const stats = [
    { label: "Total Patients", value: patientRes.count ?? 0, color: "#00D4AA" },
    { label: "Total Encounters", value: encounterRes.count ?? 0, color: "#6366f1" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{tenant.hospitalName}</h1>
        <p className="text-slate-400 text-sm mt-1">{user?.email ?? "Dashboard"}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#0D1B2E] border border-slate-800 rounded-xl p-5">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              {s.label}
            </p>
            <p className="text-3xl font-bold mt-2" style={{ color: s.color }}>
              {s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href={`/os/${slug}/patients`}
          className="bg-[#0D1B2E] border border-slate-800 hover:border-[#00D4AA]/40 rounded-xl p-5 transition-colors block"
        >
          <p className="text-[#00D4AA] font-semibold mb-1">Patients →</p>
          <p className="text-slate-400 text-sm">Search and manage patient records</p>
        </Link>
        <Link
          href={`/os/${slug}/encounters/new`}
          className="bg-[#0D1B2E] border border-slate-800 hover:border-indigo-400/40 rounded-xl p-5 transition-colors block"
        >
          <p className="text-indigo-400 font-semibold mb-1">New Encounter →</p>
          <p className="text-slate-400 text-sm">Start a clinical encounter with AI assist</p>
        </Link>
        <Link
          href={`/os/${slug}/migrate`}
          className="bg-[#0D1B2E] border border-slate-800 hover:border-amber-400/40 rounded-xl p-5 transition-colors block"
        >
          <p className="text-amber-400 font-semibold mb-1">Import Data →</p>
          <p className="text-slate-400 text-sm">Migrate patients from CSV or OpenMRS</p>
        </Link>
      </div>
    </div>
  );
}
