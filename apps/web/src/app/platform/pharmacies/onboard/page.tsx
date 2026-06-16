"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const MODULES: Array<[string, string]> = [
  ["pharmacy_network", "Network inventory visibility"],
  ["in_app_orders", "In-app patient orders"],
  ["prescription_fulfillment", "Prescription fulfillment"],
  ["inventory_migration", "Legacy data migration"],
  ["offline_first_pos", "Offline-first POS"],
  ["sms_refill_reminders", "SMS refill reminders"],
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

export default function PharmacyOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [pharmacyName, setPharmacyName] = useState("");
  const [slug, setSlug] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [district, setDistrict] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [plan, setPlan] = useState("starter");
  const [migrationSource, setMigrationSource] = useState("csv_excel");
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState("5");
  const [networkVisible, setNetworkVisible] = useState(true);
  const [modules, setModules] = useState<string[]>(MODULES.map(([key]) => key));

  const computedSlug = useMemo(() => slugify(slug || pharmacyName), [slug, pharmacyName]);
  const defaultDomain = computedSlug ? `https://pharm.synapseos.tech/${computedSlug}` : "https://pharm.synapseos.tech/your-pharmacy";

  function toggleModule(key: string) {
    setModules((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/platform/pharmacies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pharmacyName,
          slug: computedSlug,
          licenseNumber,
          licenseExpiry,
          district,
          physicalAddress,
          contactName,
          contactPhone,
          adminEmail,
          tempPassword: tempPassword.trim() || undefined,
          customDomain,
          plan,
          migrationSource,
          deliveryAvailable,
          deliveryRadiusKm: Number(deliveryRadiusKm),
          networkVisible,
          modules,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to create pharmacy");
      router.push("/platform/pharmacy-network");
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Creation failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Pharmacy SaaS Onboarding</p>
        <h1 className="mt-2 text-2xl font-bold">Onboard Pharmacy</h1>
        <p className="mt-1 text-sm text-slate-400">Step {step} of 4: create the tenant, domain route, modules, migration readiness, and pharmacy admin account.</p>
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#111117] p-5">
        {step === 1 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">Pharmacy name</span>
              <input value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">License number</span>
              <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">License expiry</span>
              <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">District</span>
              <input value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Physical address</span>
              <input value={physicalAddress} onChange={(e) => setPhysicalAddress(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">Default route slug</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(pharmacyName)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
              <p className="text-xs text-[#E8B84B]">{defaultDomain}</p>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">Custom domain</span>
              <input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="rx.example.ug" className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
              <p className="text-xs text-slate-500">DNS verification instructions appear in the network monitor.</p>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">Plan</span>
              <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm">
                <option value="trial">trial</option>
                <option value="starter">starter</option>
                <option value="professional">professional</option>
                <option value="enterprise">enterprise</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">Migration source</span>
              <select value={migrationSource} onChange={(e) => setMigrationSource(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm">
                <option value="csv_excel">CSV / Excel</option>
                <option value="quickbooks">QuickBooks</option>
                <option value="legacy_system">Legacy pharmacy system</option>
                <option value="manual">Manual entry</option>
              </select>
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULES.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm">
                  <input type="checkbox" checked={modules.includes(key)} onChange={() => toggleModule(key)} className="accent-[#F97316]" />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={networkVisible} onChange={(e) => setNetworkVisible(e.target.checked)} className="accent-[#F97316]" />
              Visible to patients in drug finder and refill choices
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={deliveryAvailable} onChange={(e) => setDeliveryAvailable(e.target.checked)} className="accent-[#F97316]" />
              Delivery available
            </label>
            <label className="block max-w-xs space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">Delivery radius km</span>
              <input value={deliveryRadiusKm} onChange={(e) => setDeliveryRadiusKm(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">Contact person</span>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">Contact phone</span>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Pharmacy admin email</span>
              <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm" />
              <p className="text-xs text-slate-500">This becomes the login username. Must not already exist in Synapse.</p>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">Temporary password <span className="normal-case text-slate-600">(optional — auto-generated if blank)</span></span>
              <input
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="e.g. KiuPharm2026!"
                className="w-full rounded-lg border border-slate-700 bg-[#07070A] px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-slate-500">Min 8 chars. Admin must change it on first login. Leave blank to auto-generate.</p>
            </label>
            <div className="rounded-lg border border-[#E8B84B]/30 bg-[#E8B84B]/10 p-3 text-xs text-[#E8B84B] md:col-span-2">
              Admin receives a credentials email with their login email and this password. They log in at pharm.synapseos.tech/login.
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex items-center justify-between">
        <button type="button" disabled={step === 1 || submitting} onClick={() => setStep((current) => Math.max(1, current - 1))} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-40">
          Back
        </button>
        {step < 4 ? (
          <button type="button" disabled={submitting} onClick={() => setStep((current) => Math.min(4, current + 1))} className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white">
            Continue
          </button>
        ) : (
          <button type="button" disabled={submitting} onClick={submit} className="rounded-lg bg-[#E8B84B] px-4 py-2 text-sm font-semibold text-[#07070A] disabled:opacity-50">
            {submitting ? "Creating..." : "Create Pharmacy"}
          </button>
        )}
      </div>
    </div>
  );
}
