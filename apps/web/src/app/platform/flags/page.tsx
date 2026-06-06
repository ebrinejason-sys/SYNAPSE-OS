export const dynamic = "force-dynamic";

import { createServiceClient } from "../../../lib/supabase/server";
import { requirePlatformAdmin } from "../../../lib/platform/auth";

const GLOBAL_KEYS = [
  "maintenance_mode",
  "ai_diagnosis_enabled",
  "telemedicine_enabled",
  "demo_enabled",
  "new_registration_open",
];

async function upsertGlobalFlag(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const key = String(formData.get("key") ?? "");
  const value = formData.get("value") === "on";

  if (!key) {
    return;
  }

  const supabaseAdmin = createServiceClient();
  await (supabaseAdmin as any).from("platform_flags").upsert(
    {
      key,
      value,
      hospital_id: null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
}

async function upsertHospitalFlag(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const hospitalId = String(formData.get("hospital_id") ?? "");
  const key = String(formData.get("key") ?? "");
  const value = formData.get("value") === "on";

  if (!hospitalId || !key) {
    return;
  }

  const supabaseAdmin = createServiceClient();
  await (supabaseAdmin as any).from("platform_flags").upsert(
    {
      key: `${hospitalId}:${key}`,
      value,
      hospital_id: hospitalId,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
}

export default async function PlatformFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ hospital?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const selectedHospital = params.hospital ?? "";

  const supabaseAdmin = createServiceClient();
  const [{ data: globalFlags }, { data: hospitals }, { data: hospitalOverrides }] = await Promise.all([
    (supabaseAdmin as any).from("platform_flags").select("key, value").is("hospital_id", null),
    (supabaseAdmin as any).from("hospitals").select("id, name").order("name", { ascending: true }),
    selectedHospital
      ? (supabaseAdmin as any)
          .from("platform_flags")
          .select("key, value")
          .eq("hospital_id", selectedHospital)
      : Promise.resolve({ data: [] }),
  ]);

  const globalMap = new Map<string, boolean>((globalFlags ?? []).map((flag: any) => [flag.key, Boolean(flag.value)]));
  const hospitalMap = new Map<string, boolean>(
    (hospitalOverrides ?? []).map((flag: any) => [String(flag.key).split(":").at(-1) ?? "", Boolean(flag.value)])
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <h1 className="text-xl font-bold">Global Flags</h1>
        <p className="mt-1 text-sm text-slate-400">These apply across all hospitals unless overridden.</p>
        <div className="mt-4 space-y-3">
          {GLOBAL_KEYS.map((key) => (
            <form key={key} action={upsertGlobalFlag} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2">
              <input type="hidden" name="key" value={key} />
              <span className="text-sm text-slate-200">{key}</span>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" name="value" defaultChecked={globalMap.get(key) ?? false} />
                Enabled
              </label>
              <button type="submit" className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">Save</button>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-xl font-bold">Per-Hospital Overrides</h2>
        <form className="mt-3" method="get">
          <select name="hospital" defaultValue={selectedHospital} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option value="">Select hospital...</option>
            {(hospitals ?? []).map((hospital: any) => (
              <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
            ))}
          </select>
          <button type="submit" className="mt-2 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">Load</button>
        </form>

        {selectedHospital ? (
          <div className="mt-4 space-y-3">
            {GLOBAL_KEYS.map((key) => (
              <form key={key} action={upsertHospitalFlag} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2">
                <input type="hidden" name="hospital_id" value={selectedHospital} />
                <input type="hidden" name="key" value={key} />
                <span className="text-sm text-slate-200">{key}</span>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input type="checkbox" name="value" defaultChecked={hospitalMap.get(key) ?? false} />
                  Override
                </label>
                <button type="submit" className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">Save</button>
              </form>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Search and select a hospital to configure overrides.</p>
        )}
      </section>
    </div>
  );
}
