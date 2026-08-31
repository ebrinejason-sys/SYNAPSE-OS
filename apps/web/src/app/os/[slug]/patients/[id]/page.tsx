import { createClient } from "../../../../../lib/supabase/server";
import { headers } from "next/headers";
import { resolveTenant } from "../../../../../lib/tenant";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const hdrs = await headers();
  const subdomain = hdrs.get("x-hospital-subdomain") ?? slug;
  const tenant = await resolveTenant(subdomain);
  if (!tenant) return <div className="p-8 text-red-400">Tenant not found</div>;

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: patient } = await (supabase as any)
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenant.tenantId)
    .single();

  if (!patient) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: encounters } = await (supabase as any)
    .from("encounters")
    .select("id, visit_date, status, chief_complaint, clinical_stage")
    .eq("patient_id", id)
    .eq("tenant_id", tenant.tenantId)
    .order("visit_date", { ascending: false })
    .limit(10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: vitals } = await (supabase as any)
    .from("vitals")
    .select("bp_systolic, bp_diastolic, heart_rate, temperature_c, spo2, respiratory_rate, created_at")
    .eq("patient_id", id)
    .eq("tenant_id", tenant.tenantId)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestVitals = vitals?.[0] as Record<string, unknown> | undefined;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/os/${slug}/patients`} className="text-xs text-slate-400 hover:text-white mb-2 block">
            ← Patients
          </Link>
          <h1 className="text-2xl font-bold">{patient.full_name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            MRN: {patient.mrn ?? "—"} · {patient.sex ?? "—"} · DOB: {patient.date_of_birth ?? "—"}
          </p>
        </div>
        <Link
          href={`/os/${slug}/encounters/new?patientId=${id}`}
          className="bg-[#00D4AA] text-[#060D1A] font-semibold px-4 py-2 rounded-lg text-sm"
        >
          + New Encounter
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0D1B2E] border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-sm text-slate-300 mb-3 uppercase tracking-wider">
            Recent Encounters
          </h2>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {((encounters as any[]) ?? []).length === 0 ? (
            <p className="text-slate-500 text-sm">No encounters yet</p>
          ) : (
            <div className="space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {((encounters as any[]) ?? []).map((e: any) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
                >
                  <div>
                    <p className="text-sm text-white">{e.chief_complaint ?? "No complaint recorded"}</p>
                    <p className="text-xs text-slate-400">
                      {e.visit_date ? new Date(e.visit_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/os/${slug}/clinical/orders?encounterId=${e.id}&patientId=${id}`}
                      className="text-xs text-indigo-300 hover:text-indigo-200"
                    >
                      Orders
                    </Link>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      {e.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0D1B2E] border border-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-sm text-slate-300 mb-3 uppercase tracking-wider">
            Latest Vitals
          </h2>
          {!latestVitals ? (
            <p className="text-slate-500 text-sm">No vitals recorded</p>
          ) : (
            <div className="space-y-2 text-sm">
              {(
                [
                  ["bp_systolic", "BP Systolic"],
                  ["bp_diastolic", "BP Diastolic"],
                  ["heart_rate", "Heart Rate"],
                  ["temperature_c", "Temp (°C)"],
                  ["spo2", "SpO2 (%)"],
                  ["respiratory_rate", "RR"],
                ] as const
              ).map(([key, label]) => {
                const val = latestVitals[key];
                if (val == null) return null;
                return (
                  <div key={key} className="flex justify-between">
                    <span className="text-slate-400 text-xs">{label}</span>
                    <span className="text-white">{String(val)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
