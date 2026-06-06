export const dynamic = "force-dynamic";

import Link from "next/link";
import { createServiceClient } from "../../../lib/supabase/server";
import { requirePlatformAdmin } from "../../../lib/platform/auth";

async function suspendHospital(formData: FormData) {
  "use server";
  await requirePlatformAdmin();

  const hospitalId = String(formData.get("hospitalId") ?? "");
  if (!hospitalId) {
    return;
  }

  const supabaseAdmin = createServiceClient();
  await (supabaseAdmin as any).from("tenants").update({ status: "suspended" }).eq("id", hospitalId);
}

async function getHospitalsTable() {
  const supabaseAdmin = createServiceClient();

  const { data: hospitals } = await (supabaseAdmin as any)
    .from("hospitals")
    .select("id, name, subdomain, subscription_tier, created_at, status")
    .order("created_at", { ascending: false });

  const rows = await Promise.all(
    ((hospitals ?? []) as any[]).map(async (hospital) => {
      const [modules, staff, patients] = await Promise.all([
        (supabaseAdmin as any)
          .from("hospital_modules")
          .select("id", { count: "exact", head: true })
          .eq("hospital_id", hospital.id)
          .eq("is_active", true),
        (supabaseAdmin as any)
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("hospital_id", hospital.id),
        (supabaseAdmin as any)
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("hospital_id", hospital.id),
      ]);

      return {
        ...hospital,
        modulesCount: modules.count ?? 0,
        staffCount: staff.count ?? 0,
        patientCount: patients.count ?? 0,
      };
    })
  );

  return rows;
}

function statusClass(status: string | null) {
  if (status === "suspended") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  if (status === "trial") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

export default async function PlatformHospitalsPage() {
  await requirePlatformAdmin();
  const hospitals = await getHospitalsTable();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hospital Management</h1>
          <p className="text-sm text-slate-400">Manage subscriptions, modules, and tenant status across all hospitals.</p>
        </div>
        <Link
          href="/platform/hospitals/new"
          className="rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-[#07070A] hover:bg-[#FB923C]"
        >
          New Hospital
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Subdomain</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Modules</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3">Patients</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {hospitals.map((hospital) => (
              <tr key={hospital.id} className="align-top">
                <td className="px-4 py-3 font-medium text-slate-100">{hospital.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-[#E8B84B]">{hospital.subdomain}</td>
                <td className="px-4 py-3 text-slate-300">{hospital.subscription_tier ?? "starter"}</td>
                <td className="px-4 py-3 text-slate-300">{hospital.modulesCount}</td>
                <td className="px-4 py-3 text-slate-300">{hospital.staffCount}</td>
                <td className="px-4 py-3 text-slate-300">{hospital.patientCount}</td>
                <td className="px-4 py-3 text-slate-400">{new Date(hospital.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(hospital.status ?? "active")}`}>
                    {(hospital.status ?? "active").toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/platform/hospitals/${hospital.id}`} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500">
                      View
                    </Link>
                    <Link href={`/platform/hospitals/${hospital.id}?modal=edit`} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500">
                      Edit
                    </Link>
                    <Link href={`/platform/hospitals/${hospital.id}?modal=modules`} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500">
                      Toggle modules
                    </Link>
                    <form action={suspendHospital}>
                      <input type="hidden" name="hospitalId" value={hospital.id} />
                      <button type="submit" className="rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">
                        Suspend
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {hospitals.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                  No hospitals found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
