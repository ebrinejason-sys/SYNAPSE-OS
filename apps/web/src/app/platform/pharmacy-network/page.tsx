export const dynamic = "force-dynamic";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Download, Globe2, MapPinned, Pill, RefreshCcw, UploadCloud } from "lucide-react";
import { createServiceClient } from "../../../lib/supabase/server";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { provisionVercelProjectDomain, verifyVercelProjectDomain } from "../../../lib/vercel-domains";
import { formatDateTime, logPlatformEvent, safeCount, safeRows } from "../_lib/platform-data";

type PharmacyRow = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  facility_type?: string | null;
  district?: string | null;
  is_active?: boolean | null;
  updated_at?: string | null;
};

type PharmacyProfileRow = {
  tenant_id?: string | null;
  custom_domain?: string | null;
  custom_domain_verified?: boolean | null;
  default_domain?: string | null;
  domain_status?: string | null;
  domain_error?: string | null;
  domain_verification?: unknown[] | null;
  migrated_from?: string | null;
  migration_status?: string | null;
  migration_completed_at?: string | null;
  is_network_visible?: boolean | null;
  delivery_available?: boolean | null;
};

type InventoryRow = {
  id?: string;
  pharmacy_tenant_id?: string | null;
  drug_name?: string | null;
  generic_name?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  quantity_in_stock?: number | null;
  last_synced_at?: string | null;
};

async function updatePharmacyDomain(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const customDomain = String(formData.get("custom_domain") ?? "").trim().toLowerCase();
  if (!tenantId || !customDomain) return;

  const supabaseAdmin = createServiceClient();
  const provisioning = await provisionVercelProjectDomain(customDomain);
  try {
    await (supabaseAdmin as any)
      .from("pharmacy_profiles")
      .upsert(
        {
          tenant_id: tenantId,
          custom_domain: customDomain,
          custom_domain_verified: provisioning.verified,
          custom_domain_verified_at: provisioning.verified ? new Date().toISOString() : null,
          vercel_domain_id: provisioning.vercelDomainId,
          domain_status: provisioning.status,
          domain_verification: provisioning.verification,
          domain_error: provisioning.error,
          domain_configured_at: new Date().toISOString(),
          last_domain_check_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );
  } catch {}

  await logPlatformEvent({
    actorId: profile.id,
    action: "pharmacy.custom_domain_requested",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: {
      custom_domain: customDomain,
      domain_status: provisioning.status,
      domain_error: provisioning.error,
      dns_instruction: `Add TXT record _synapse.${customDomain} with value synapse-domain-verification=${tenantId.slice(0, 8)}`,
    },
  });
  revalidatePath("/platform/pharmacy-network");
}

async function verifyPharmacyDomain(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const customDomain = String(formData.get("custom_domain") ?? "").trim().toLowerCase();
  if (!tenantId || !customDomain) return;

  const verification = await verifyVercelProjectDomain(customDomain);
  const supabaseAdmin = createServiceClient();
  try {
    await (supabaseAdmin as any)
      .from("pharmacy_profiles")
      .upsert(
        {
          tenant_id: tenantId,
          custom_domain: customDomain,
          custom_domain_verified: verification.verified,
          custom_domain_verified_at: verification.verified ? new Date().toISOString() : null,
          vercel_domain_id: verification.vercelDomainId,
          domain_status: verification.status,
          domain_verification: verification.verification,
          domain_error: verification.error,
          last_domain_check_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );
  } catch {}

  await logPlatformEvent({
    actorId: profile.id,
    action: "pharmacy.custom_domain_verified",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: { custom_domain: customDomain, domain_status: verification.status, domain_error: verification.error },
  });
  revalidatePath("/platform/pharmacy-network");
}

async function markMigrationReady(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const source = String(formData.get("migration_source") ?? "csv_excel");
  if (!tenantId) return;

  const supabaseAdmin = createServiceClient();
  try {
    await (supabaseAdmin as any)
      .from("pharmacy_profiles")
      .upsert(
        {
          tenant_id: tenantId,
          migrated_from: source,
          migration_status: "ready_for_upload",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );
  } catch {}

  await logPlatformEvent({
    actorId: profile.id,
    action: "pharmacy.migration_ready",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
    metadata: { migration_source: source },
  });
  revalidatePath("/platform/pharmacy-network");
}

async function forceInventorySync(formData: FormData) {
  "use server";
  const profile = await requirePlatformAdmin();
  const tenantId = String(formData.get("tenant_id") ?? "");
  if (!tenantId) return;

  const supabaseAdmin = createServiceClient();
  try {
    await (supabaseAdmin as any)
      .from("pharmacy_network_inventory")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("pharmacy_tenant_id", tenantId);
  } catch {}

  await logPlatformEvent({
    actorId: profile.id,
    action: "pharmacy.inventory_sync_requested",
    entityType: "tenant",
    entityId: tenantId,
    tenantId,
  });
  revalidatePath("/platform/pharmacy-network");
}

export default async function PharmacyNetworkPage() {
  await requirePlatformAdmin();

  const [pharmacies, profiles, inventory, syncedRecently] = await Promise.all([
    safeRows<PharmacyRow>("tenants", "id, name, slug, facility_type, district, is_active, updated_at", {
      filters: [["facility_type", "pharmacy"]],
      orderBy: "updated_at",
      limit: 200,
    }),
    safeRows<PharmacyProfileRow>(
      "pharmacy_profiles",
      "tenant_id, custom_domain, custom_domain_verified, default_domain, domain_status, domain_error, domain_verification, migrated_from, migration_status, migration_completed_at, is_network_visible, delivery_available",
      { limit: 1000 }
    ),
    safeRows<InventoryRow>(
      "pharmacy_network_inventory",
      "id, pharmacy_tenant_id, drug_name, generic_name, dosage_form, strength, quantity_in_stock, last_synced_at",
      { orderBy: "last_synced_at", limit: 200 }
    ),
    safeCount("pharmacy_network_inventory"),
  ]);

  const inventoryByPharmacy = new Map<string, InventoryRow[]>();
  const profileByTenant = new Map(profiles.map((profile) => [profile.tenant_id, profile]));
  for (const item of inventory) {
    const key = item.pharmacy_tenant_id ?? "unknown";
    inventoryByPharmacy.set(key, [...(inventoryByPharmacy.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Synapse Pharm Network</p>
          <h1 className="mt-2 text-2xl font-bold">Pharmacy Network Monitor</h1>
          <p className="mt-1 text-sm text-slate-400">Monitor standalone pharmacies, inventory sync health, and network-wide drug availability.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/platform/pharmacies/onboard" className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA6C0A]">
            <UploadCloud className="h-4 w-4" />
            Onboard pharmacy
          </Link>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-4 py-2 text-sm font-semibold text-[#E8B84B]">
            <Download className="h-4 w-4" />
            Export inventory
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Pharmacies", pharmacies.length],
          ["Network drug rows", inventory.length],
          ["Synced rows", syncedRecently],
          ["Visible to patients", profiles.filter((profile) => profile.is_network_visible !== false).length],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border border-slate-800 bg-[#111117] p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[#F97316]">{Number(value).toLocaleString()}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <article className="overflow-hidden rounded-xl border border-slate-800 bg-[#111117]">
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <h2 className="text-sm font-semibold">Connected Pharmacies</h2>
            <MapPinned className="h-4 w-4 text-[#E8B84B]" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#07070A] text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pharmacy</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Drug rows</th>
                  <th className="px-4 py-3">Last sync</th>
                  <th className="px-4 py-3">Migration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pharmacies.map((pharmacy) => {
                  const rows = inventoryByPharmacy.get(pharmacy.id ?? "") ?? [];
                  const pharmacyProfile = profileByTenant.get(pharmacy.id ?? "");
                  const latestSync = rows[0]?.last_synced_at ?? pharmacy.updated_at;
                  const defaultDomain = pharmacyProfile?.default_domain ?? `${pharmacy.slug ?? pharmacy.id ?? "pharm"}.synapseos.tech`;
                  const customDomain = pharmacyProfile?.custom_domain;
                  const domainStatus = customDomain
                    ? pharmacyProfile?.custom_domain_verified
                      ? "verified custom"
                      : pharmacyProfile?.domain_status?.replace(/_/g, " ") ?? "DNS pending"
                    : "default route";
                  return (
                    <tr key={pharmacy.id ?? pharmacy.name ?? crypto.randomUUID()}>
                      <td className="px-4 py-3 font-medium text-slate-100">{pharmacy.name ?? "Unnamed pharmacy"}</td>
                      <td className="px-4 py-3 text-slate-400">{pharmacy.district ?? "Unknown"}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-mono text-xs text-[#E8B84B]">{customDomain || defaultDomain}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${pharmacyProfile?.custom_domain_verified ? "border-green-500/25 bg-green-500/10 text-green-300" : "border-slate-700 bg-slate-800 text-slate-400"}`}>
                            {domainStatus}
                          </span>
                          {pharmacyProfile?.domain_error ? <p className="max-w-56 text-[11px] text-red-300">{pharmacyProfile.domain_error}</p> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{rows.length}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(latestSync)}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-300">{pharmacyProfile?.migration_status ?? "not started"}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{pharmacyProfile?.migrated_from ?? "source pending"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-xs text-green-300">
                          {rows.length > 0 ? "synced" : "waiting"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-64 flex-wrap gap-2">
                          <form action={forceInventorySync}>
                            <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                            <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">
                              <RefreshCcw className="h-3 w-3" />
                              Force sync
                            </button>
                          </form>
                          <form action={markMigrationReady} className="flex flex-wrap gap-2">
                            <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                            <select name="migration_source" defaultValue={pharmacyProfile?.migrated_from ?? "csv_excel"} className="rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1 text-xs text-slate-300">
                              <option value="csv_excel">CSV/Excel</option>
                              <option value="quickbooks">QuickBooks</option>
                              <option value="legacy_system">Legacy system</option>
                              <option value="manual">Manual</option>
                            </select>
                            <button type="submit" className="rounded-lg border border-[#E8B84B]/30 px-2 py-1 text-xs text-[#E8B84B]">Migration ready</button>
                          </form>
                          <form action={updatePharmacyDomain} className="flex flex-wrap gap-2">
                            <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                            <input name="custom_domain" placeholder="rx.example.ug" defaultValue={customDomain ?? ""} className="w-32 rounded-lg border border-slate-700 bg-[#07070A] px-2 py-1 text-xs text-slate-300" />
                            <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">
                              <Globe2 className="h-3 w-3" />
                              Domain
                            </button>
                          </form>
                          {customDomain ? (
                            <form action={verifyPharmacyDomain}>
                              <input type="hidden" name="tenant_id" value={pharmacy.id ?? ""} />
                              <input type="hidden" name="custom_domain" value={customDomain} />
                              <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-green-500/30 px-2 py-1 text-xs text-green-300">
                                <Globe2 className="h-3 w-3" />
                                Verify
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pharmacies.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No pharmacy tenants found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="rounded-xl border border-slate-800 bg-[#111117] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Pill className="h-4 w-4 text-[#E8B84B]" />
            <h2 className="text-sm font-semibold">Recent Inventory Rows</h2>
          </div>
          <div className="space-y-2">
            {inventory.length === 0 ? <p className="rounded-lg border border-slate-800 bg-[#07070A] p-4 text-sm text-slate-500">No network inventory yet.</p> : null}
            {inventory.slice(0, 12).map((item) => (
              <div key={item.id ?? item.drug_name ?? crypto.randomUUID()} className="rounded-lg border border-slate-800 bg-[#07070A] p-3">
                <p className="text-sm font-semibold text-slate-100">{item.drug_name ?? "Unnamed drug"}</p>
                <p className="mt-1 text-xs text-slate-500">{item.generic_name ?? "Generic not set"} · {item.strength ?? "strength n/a"}</p>
                <p className="mt-1 text-xs text-[#E8B84B]">{Number(item.quantity_in_stock ?? 0).toLocaleString()} in stock</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
