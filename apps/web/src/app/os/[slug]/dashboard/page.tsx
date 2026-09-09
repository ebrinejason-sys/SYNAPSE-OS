import { headers } from "next/headers";
import { getCurrentUser } from "../../../../lib/auth/getCurrentUser";
import { createServiceClient } from "../../../../lib/supabase/server";
import { resolveTenant } from "../../../../lib/tenant";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  ClipboardList,
  FlaskConical,
  Pill,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";

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
  if (tenant.facilityType === "laboratory") redirect("/lab/orders");

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
    { label: "Total patients", value: patientRes.count ?? 0, color: "#2563EB", icon: Users, note: "Registered in this facility" },
    { label: "Total encounters", value: encounterRes.count ?? 0, color: "#0F766E", icon: ClipboardList, note: "Across the hospital record" },
  ];

  const initial = (user?.email?.[0] ?? "S").toUpperCase();

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Clinical operations</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{tenant.hospitalName}</h1>
          <p className="text-secondary-color text-sm mt-1">A clear view of today&apos;s connected care workflow.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-edge bg-surface py-1.5 pl-1.5 pr-3 shadow-sm" title={user?.email ?? "Signed-in staff"}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">{initial}</span>
          <span className="hidden max-w-40 truncate text-xs font-medium text-secondary-color sm:block">{user?.email ?? "Signed-in staff"}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="clinical-card flex items-center justify-between p-5 shadow-sm">
            <div>
              <p className="text-muted-color text-xs font-semibold uppercase tracking-wider">{s.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-color">{s.note}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50" style={{ color: s.color }}>
              <s.icon size={22} strokeWidth={1.8} />
            </span>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-color">Workflow launchpad</p>
          <h2 className="mt-1 text-lg font-semibold">Move care forward</h2>
        </div>
        <span className="hidden text-xs text-muted-color sm:block">Connected departments</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/os/${slug}/patients`}
          className="clinical-card group block border-l-4 border-l-blue-600 p-5 transition-colors hover:border-blue-600"
        >
          <div className="mb-4 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UserPlus size={18} /></span><ArrowUpRight className="text-muted-color transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={18} /></div>
          <p className="font-semibold text-blue-800 mb-1">Patients</p>
          <p className="text-muted-color text-sm">Register and search patients</p>
        </Link>
        <Link
          href={`/os/${slug}/clinical/queue`}
          className="clinical-card group block border-l-4 border-l-cyan-600 p-5 transition-colors hover:border-cyan-600"
        >
          <div className="mb-4 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><Stethoscope size={18} /></span><ArrowUpRight className="text-muted-color transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={18} /></div>
          <p className="font-semibold text-cyan-800 mb-1">OPD queue</p>
          <p className="text-muted-color text-sm">Today&apos;s encounters and sign/amend</p>
        </Link>
        <Link
          href={`/os/${slug}/encounters/new`}
          className="clinical-card group block border-l-4 border-l-teal-600 p-5 transition-colors hover:border-teal-600"
        >
          <div className="mb-4 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Stethoscope size={18} /></span><ArrowUpRight className="text-muted-color transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={18} /></div>
          <p className="font-semibold text-teal-800 mb-1">New encounter</p>
          <p className="text-muted-color text-sm">Triage, orders, and prescriptions</p>
        </Link>
        <Link
          href={`/os/${slug}/clinical/tasks`}
          className="clinical-card group block border-l-4 border-l-amber-600 p-5 transition-colors hover:border-amber-600"
        >
          <div className="mb-4 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><ClipboardList size={18} /></span><ArrowUpRight className="text-muted-color transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={18} /></div>
          <p className="font-semibold text-amber-800 mb-1">Department tasks</p>
          <p className="text-muted-color text-sm">WorkQueue handoffs across departments</p>
        </Link>
        <Link href="/lab/orders" className="clinical-card group block border-l-4 border-l-violet-600 p-5 transition-colors hover:border-violet-600">
          <div className="mb-4 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><FlaskConical size={18} /></span><ArrowUpRight className="text-muted-color transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={18} /></div>
          <p className="font-semibold text-violet-800 mb-1">Lab worklist</p>
          <p className="text-muted-color text-sm">Collect, result, verify (production DB path)</p>
        </Link>
        <Link
          href={`/os/${slug}/clinical/dispense`}
          className="clinical-card group block border-l-4 border-l-teal-600 p-5 transition-colors hover:border-teal-600"
        >
          <div className="mb-4 flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Pill size={18} /></span><ArrowUpRight className="text-muted-color transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={18} /></div>
          <p className="font-semibold text-teal-800 mb-1">Pharmacy dispense</p>
          <p className="text-muted-color text-sm">Verify Rx and decrement inventory</p>
        </Link>
      </div>
    </div>
  );
}
