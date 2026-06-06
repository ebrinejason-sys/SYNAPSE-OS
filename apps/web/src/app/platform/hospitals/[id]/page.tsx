export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createServiceClient } from "../../../../lib/supabase/server";
import { requirePlatformAdmin } from "../../../../lib/platform/auth";

export default async function PlatformHospitalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const supabaseAdmin = createServiceClient();

  const { data: hospital } = await (supabaseAdmin as any)
    .from("hospitals")
    .select("id, name, subdomain, type, status, created_at, subscription_tier, contact_email")
    .eq("id", id)
    .maybeSingle();

  if (!hospital) {
    notFound();
  }

  const { data: modules } = await (supabaseAdmin as any)
    .from("hospital_modules")
    .select("module_key, is_active")
    .eq("hospital_id", id)
    .order("module_key", { ascending: true });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{hospital.name}</h1>
        <p className="text-sm text-slate-400">{hospital.subdomain}.synapseos.tech</p>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-500">Subscription Tier</p>
          <p className="mt-1 text-lg text-slate-100">{hospital.subscription_tier ?? "starter"}</p>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-500">Status</p>
          <p className="mt-1 text-lg text-slate-100">{hospital.status ?? "active"}</p>
        </article>
        <article className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-500">Contact Email</p>
          <p className="mt-1 text-lg text-slate-100">{hospital.contact_email ?? "-"}</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Enabled Modules</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(modules ?? []).map((mod: { module_key: string; is_active: boolean }) => (
            <div key={mod.module_key} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm">
              <span className="text-slate-200">{mod.module_key}</span>
              <span className={mod.is_active ? "text-emerald-300" : "text-slate-500"}>{mod.is_active ? "Active" : "Off"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
