import { headers } from "next/headers";
import { getCurrentUser } from "../../../../lib/auth/getCurrentUser";
import { createServiceClient } from "../../../../lib/supabase/server";
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

  const user = await getCurrentUser();

  const supabase = createServiceClient();
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href={`/os/${slug}/patients`}
          className="clinical-card block p-5 transition-colors hover:border-emerald-500/40"
        >
          <p className="font-semibold text-emerald-400 mb-1">Patients →</p>
          <p className="text-muted-color text-sm">Register and search patients</p>
        </Link>
        <Link
          href={`/os/${slug}/clinical/queue`}
          className="clinical-card block p-5 transition-colors hover:border-indigo-400/40"
        >
          <p className="font-semibold text-indigo-400 mb-1">OPD queue →</p>
          <p className="text-muted-color text-sm">Today&apos;s encounters and sign/amend</p>
        </Link>
        <Link
          href={`/os/${slug}/encounters/new`}
          className="clinical-card block p-5 transition-colors hover:border-teal-400/40"
        >
          <p className="font-semibold text-teal-400 mb-1">New encounter →</p>
          <p className="text-muted-color text-sm">Triage, orders, and prescriptions</p>
        </Link>
        <Link
          href={`/os/${slug}/clinical/tasks`}
          className="clinical-card block p-5 transition-colors hover:border-amber-400/40"
        >
          <p className="font-semibold text-amber-400 mb-1">Department tasks →</p>
          <p className="text-muted-color text-sm">WorkQueue handoffs across departments</p>
        </Link>
        <Link href="/lab/orders" className="clinical-card block p-5 transition-colors hover:border-sky-400/40">
          <p className="font-semibold text-sky-400 mb-1">Lab worklist →</p>
          <p className="text-muted-color text-sm">Collect, result, verify (production DB path)</p>
        </Link>
        <Link
          href={`/os/${slug}/clinical/dispense`}
          className="clinical-card block p-5 transition-colors hover:border-orange-400/40"
        >
          <p className="font-semibold text-orange-400 mb-1">Pharmacy dispense →</p>
          <p className="text-muted-color text-sm">Verify Rx and decrement inventory</p>
        </Link>
      </div>
    </div>
  );
}
