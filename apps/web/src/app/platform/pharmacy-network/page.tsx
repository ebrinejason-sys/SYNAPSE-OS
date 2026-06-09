export const dynamic = "force-dynamic";

import { Download, MapPinned, Pill, RefreshCcw } from "lucide-react";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { formatDateTime, safeCount, safeRows } from "../_lib/platform-data";

type PharmacyRow = {
  id?: string;
  name?: string | null;
  district?: string | null;
  status?: string | null;
  updated_at?: string | null;
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

export default async function PharmacyNetworkPage() {
  await requirePlatformAdmin();

  const [pharmacies, inventory, syncedRecently] = await Promise.all([
    safeRows<PharmacyRow>("tenants", "id, name, district, status, updated_at", {
      filters: [["type", "pharmacy"]],
      orderBy: "updated_at",
      limit: 200,
    }),
    safeRows<InventoryRow>(
      "pharmacy_network_inventory",
      "id, pharmacy_tenant_id, drug_name, generic_name, dosage_form, strength, quantity_in_stock, last_synced_at",
      { orderBy: "last_synced_at", limit: 200 }
    ),
    safeCount("pharmacy_network_inventory"),
  ]);

  const inventoryByPharmacy = new Map<string, InventoryRow[]>();
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
        <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-4 py-2 text-sm font-semibold text-[#E8B84B]">
          <Download className="h-4 w-4" />
          Export inventory
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Pharmacies", pharmacies.length],
          ["Network drug rows", inventory.length],
          ["Synced rows", syncedRecently],
          ["Sync errors", 0],
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
                  <th className="px-4 py-3">Drug rows</th>
                  <th className="px-4 py-3">Last sync</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pharmacies.map((pharmacy) => {
                  const rows = inventoryByPharmacy.get(pharmacy.id ?? "") ?? [];
                  const latestSync = rows[0]?.last_synced_at ?? pharmacy.updated_at;
                  return (
                    <tr key={pharmacy.id ?? pharmacy.name ?? crypto.randomUUID()}>
                      <td className="px-4 py-3 font-medium text-slate-100">{pharmacy.name ?? "Unnamed pharmacy"}</td>
                      <td className="px-4 py-3 text-slate-400">{pharmacy.district ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-slate-300">{rows.length}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(latestSync)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-xs text-green-300">
                          {rows.length > 0 ? "synced" : "waiting"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300">
                          <RefreshCcw className="h-3 w-3" />
                          Force sync
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pharmacies.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No pharmacy tenants found.</td></tr>
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
