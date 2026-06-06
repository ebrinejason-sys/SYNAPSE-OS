"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const MODULES = [
  "admin",
  "front_desk",
  "doctor",
  "nurse",
  "pharmacy",
  "laboratory",
  "radiology",
  "billing",
  "finance",
  "inventory",
  "insurance",
  "inpatient",
  "outpatient",
  "theatre",
  "icu",
  "hdu",
  "maternity",
  "pediatrics",
  "emergency",
  "dialysis",
  "ambulance",
  "public_health",
  "telemedicine",
  "portal",
  "analytics",
  "compliance",
  "support",
];

const TIER_DEFAULTS: Record<string, string[]> = {
  trial: ["admin", "front_desk", "doctor", "nurse", "pharmacy", "laboratory", "billing"],
  starter: ["admin", "front_desk", "doctor", "nurse", "pharmacy", "laboratory", "billing", "inventory"],
  professional: MODULES.filter((mod) => mod !== "support"),
  enterprise: MODULES,
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export default function PlatformHospitalOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [hospitalName, setHospitalName] = useState("");
  const [hospitalType, setHospitalType] = useState("Private");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [bedsCount, setBedsCount] = useState("50");
  const [subdomain, setSubdomain] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [tier, setTier] = useState("trial");
  const [modules, setModules] = useState<string[]>(TIER_DEFAULTS.trial ?? []);
  const [adminEmail, setAdminEmail] = useState("");

  const computedSubdomain = useMemo(() => {
    if (subdomain.trim()) {
      return slugify(subdomain);
    }
    return slugify(hospitalName);
  }, [subdomain, hospitalName]);

  function toggleModule(moduleKey: string) {
    setModules((prev) => (prev.includes(moduleKey) ? prev.filter((entry) => entry !== moduleKey) : [...prev, moduleKey]));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/platform/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalName,
          hospitalType,
          city,
          district,
          bedsCount: Number(bedsCount),
          subdomain: computedSubdomain,
          contactName,
          contactEmail,
          contactPhone,
          tier,
          modules,
          adminEmail,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create hospital");
      }

      router.push(`/platform/hospitals/${payload.id}`);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Creation failed");
      setSubmitting(false);
    }
  }

  function applyTierDefaults(nextTier: string) {
    setTier(nextTier);
    setModules(TIER_DEFAULTS[nextTier] ?? []);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Hospital Onboarding Wizard</h1>
        <p className="text-sm text-slate-400">Step {step} of 5</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        {step === 1 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Hospital Name</span>
              <input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Type</span>
              <select value={hospitalType} onChange={(e) => setHospitalType(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                <option>Public</option>
                <option>Private</option>
                <option>NGO</option>
                <option>Mission</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">City</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">District</span>
              <input value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Beds Count</span>
              <input value={bedsCount} onChange={(e) => setBedsCount(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Subdomain</span>
              <input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder={slugify(hospitalName)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              <p className="text-xs text-slate-500">Preview: {computedSubdomain}.synapseos.tech</p>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Contact Name</span>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">Contact Email</span>
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-400">Contact Phone</span>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {["trial", "starter", "professional", "enterprise"].map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => applyTierDefaults(entry)}
                className={`rounded-xl border p-4 text-left ${tier === entry ? "border-[#E8B84B] bg-[#E8B84B]/10" : "border-slate-700 bg-slate-950/50"}`}
              >
                <p className="font-semibold capitalize">{entry}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {entry === "trial" ? "30 days free" : entry === "starter" ? "UGX 250,000/mo" : entry === "professional" ? "UGX 750,000/mo" : "Custom pricing"}
                </p>
              </button>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((moduleKey) => (
              <label key={moduleKey} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm">
                <input type="checkbox" checked={modules.includes(moduleKey)} onChange={() => toggleModule(moduleKey)} />
                <span>{moduleKey}</span>
              </label>
            ))}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <label className="space-y-1 block">
              <span className="text-xs text-slate-400">Hospital Admin Email</span>
              <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </label>
            <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-300">
              Welcome email preview: The hospital admin will receive a secure account setup link, starter module summary, and quick-start instructions.
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3 text-sm text-slate-200">
            <p><strong>Hospital:</strong> {hospitalName} ({hospitalType})</p>
            <p><strong>Location:</strong> {city}, {district}</p>
            <p><strong>Subdomain:</strong> {computedSubdomain}</p>
            <p><strong>Tier:</strong> {tier}</p>
            <p><strong>Modules enabled:</strong> {modules.length}</p>
            <p><strong>Admin account:</strong> {adminEmail}</p>
            <p className="rounded-lg border border-[#E8B84B]/30 bg-[#E8B84B]/10 p-3 text-xs text-[#E8B84B]">
              By proceeding, the authorised signatory confirms they have authority to bind this hospital to the Synapse Facility Subscription Agreement and Data Processing Agreement.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={step === 1 || submitting}
          onClick={() => setStep((current) => Math.max(1, current - 1))}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
        >
          Back
        </button>

        {step < 5 ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => setStep((current) => Math.min(5, current + 1))}
            className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-[#07070A]"
          >
            Continue
          </button>
        ) : (
          <button type="button" disabled={submitting} onClick={submit} className="rounded-lg bg-[#E8B84B] px-4 py-2 text-sm font-semibold text-[#07070A] disabled:opacity-50">
            {submitting ? "Creating..." : "Create Hospital"}
          </button>
        )}
      </div>
    </div>
  );
}
