"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CANONICAL_HOSPITAL_MODULES,
  FACILITY_LEVELS,
  FACILITY_OWNERSHIP,
  FACILITY_TYPES,
  FACILITY_TYPE_LABELS,
  PHARMACY_FACILITY_MODULES,
  LABORATORY_FACILITY_MODULES,
  defaultModulesForFacilityType,
  slugify,
  type FacilityType,
  type FacilityLevel,
  type FacilityOwnership,
} from "@synapse/db/facility-provision-catalog"

const LAB_SECTION_OPTIONS: Array<[string, string]> = [
  ["reception", "Reception"], ["phlebotomy", "Phlebotomy"], ["processing", "Sample Processing"],
  ["hematology", "Hematology"], ["chemistry", "Clinical Chemistry"], ["microbiology", "Microbiology"],
  ["quality", "Quality"], ["serology", "Serology / Immunology"], ["parasitology", "Parasitology"],
  ["molecular", "Molecular / PCR"], ["histopathology", "Histopathology"], ["cytology", "Cytology"],
  ["blood_bank", "Blood Bank"], ["research", "Research"],
]

export default function CreateFacilityPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl py-16 text-center text-sm text-slate-400">Loading…</div>}>
      <CreateFacilityWizard />
    </Suspense>
  )
}

function CreateFacilityWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = (searchParams.get("type") ?? "hospital").toLowerCase() as FacilityType

  const [facilityType, setFacilityType] = useState<FacilityType>(
    FACILITY_TYPES.includes(initialType) ? initialType : "hospital",
  )
  const [facilityName, setFacilityName] = useState("")
  const [slug, setSlug] = useState("")
  const [ownership, setOwnership] = useState<FacilityOwnership>("PRIVATE")
  const [facilityLevel, setFacilityLevel] = useState<FacilityLevel>("GENERAL_HOSPITAL")
  const [city, setCity] = useState("")
  const [district, setDistrict] = useState("")
  const [physicalAddress, setPhysicalAddress] = useState("")
  const [facilityPhone, setFacilityPhone] = useState("")
  const [facilityEmail, setFacilityEmail] = useState("")
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPhone, setAdminPhone] = useState("")
  const [tier, setTier] = useState("trial")
  const [paymentStatus, setPaymentStatus] = useState<
    "ONLINE_REQUIRED" | "OFFLINE_RECEIVED" | "PENDING" | "COMPLIMENTARY"
  >("ONLINE_REQUIRED")
  const [modules, setModules] = useState<string[]>(defaultModulesForFacilityType("hospital"))
  const [includeLab, setIncludeLab] = useState(false)
  const [includeDispensing, setIncludeDispensing] = useState(false)
  const [licenseNumber, setLicenseNumber] = useState("")
  const [regulatoryNumber, setRegulatoryNumber] = useState("")
  const [accreditationStatus, setAccreditationStatus] = useState("UNKNOWN")
  const [accreditationIdentifier, setAccreditationIdentifier] = useState("")
  const [laboratoryType, setLaboratoryType] = useState("GENERAL_DIAGNOSTIC")
  const [laboratorySections, setLaboratorySections] = useState(["reception", "phlebotomy", "processing", "hematology", "chemistry", "microbiology", "quality"])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{
    ok?: boolean
    id?: string
    runId?: string
    status?: string
    facilityType?: string
    workspaceUrl?: string
    steps?: Array<{ step: string; status: string; safeErrorMessage?: string }>
    warnings?: string[]
    invitePath?: string
    inviteStatus?: string
    error?: string
    correlationId?: string
    failureStep?: string | null
    failureCode?: string | null
    failureReason?: string | null
  } | null>(null)

  const computedSlug = useMemo(() => slugify(slug || facilityName), [slug, facilityName])

  function onTypeChange(next: FacilityType) {
    setFacilityType(next)
    setModules(
      defaultModulesForFacilityType(next, facilityLevel, {
        includeLab,
        includeDispensing,
      }),
    )
  }

  const moduleCatalog =
    facilityType === "pharmacy"
      ? PHARMACY_FACILITY_MODULES.map((m) => ({ key: m.key, label: m.label }))
      : facilityType === "laboratory"
        ? LABORATORY_FACILITY_MODULES.map((m) => ({ key: m.key, label: m.label }))
        : CANONICAL_HOSPITAL_MODULES.map((m) => ({ key: m.key, label: m.label }))

  async function submit() {
    setError("")
    if (!facilityName.trim() || !adminEmail.trim() || !adminName.trim()) {
      setError("Facility name, administrator name, and email are required")
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch("/api/platform/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityType,
          facilityName,
          slug: computedSlug,
          ownership,
          facilityLevel: facilityType === "hospital" ? facilityLevel : undefined,
          city,
          district,
          physicalAddress,
          contactPhone: facilityPhone || adminPhone,
          contactEmail: facilityEmail || adminEmail,
          adminName,
          adminEmail,
          adminPhone,
          contactName: adminName,
          tier,
          paymentStatus,
          modules,
          includeLab,
          includeDispensing,
          licenseNumber: licenseNumber || undefined,
          regulatoryNumber: regulatoryNumber || undefined,
          accreditationStatus,
          accreditationIdentifier: accreditationIdentifier || undefined,
          laboratoryType,
          laboratorySections,
          sendInvite: true,
        }),
      })
      const payload = await res.json()
      setResult(payload)
      if (!res.ok || !payload.ok) {
        setError(payload.failureReason || payload.error || "Provisioning failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provisioning failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function retry() {
    if (!result?.runId) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/platform/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume", runId: result.runId }),
      })
      const payload = await res.json()
      setResult(payload)
      if (!res.ok || !payload.ok) {
        setError(payload.failureReason || payload.error || "Resume failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (result?.ok && result.id) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Provisioning</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Facility provisioning complete</h1>
          <p className="mt-1 text-sm text-slate-400">
            {facilityName} · {result.facilityType} · {result.workspaceUrl ?? result.status}
          </p>
        </div>
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          {(result.steps ?? []).map((s) => (
            <div key={s.step} className="flex justify-between text-sm">
              <span className="font-mono text-slate-300">{s.step}</span>
              <span className={s.status === "COMPLETE" ? "text-green-400" : s.status === "FAILED" ? "text-red-400" : "text-slate-400"}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-400">
          Invitation: {result.inviteStatus ?? "—"}
          {result.invitePath ? (
            <>
              {" "}
              · <code className="text-[#E8B84B]">{result.invitePath}</code>
            </>
          ) : null}
        </p>
        {paymentStatus === "OFFLINE_RECEIVED" || paymentStatus === "COMPLIMENTARY" ? (
          <div className="rounded-lg border border-[#E8B84B]/30 bg-[#E8B84B]/10 px-3 py-3 text-sm text-amber-100">
            Next: record {paymentStatus === "COMPLIMENTARY" ? "complimentary activation" : "offline payment"} on the
            facility Subscription tab to create the canonical ACTIVE subscription.
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              router.push(
                paymentStatus === "OFFLINE_RECEIVED" || paymentStatus === "COMPLIMENTARY"
                  ? `/platform/facilities/${result.id}?tab=subscription`
                  : `/platform/facilities/${result.id}`,
              )
            }
            className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-[#07070A]"
          >
            {paymentStatus === "OFFLINE_RECEIVED" || paymentStatus === "COMPLIMENTARY"
              ? "Record payment / activate"
              : "Open facility"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">Platform</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Create Facility</h1>
        <p className="mt-1 text-sm text-slate-400">One control plane for hospitals, clinics, pharmacies, and laboratories.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FACILITY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTypeChange(t)}
            className={`rounded-xl border px-4 py-3 text-left text-sm ${
              facilityType === t
                ? "border-[#E8B84B]/50 bg-[#E8B84B]/10 text-[#E8B84B]"
                : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-600"
            }`}
          >
            {FACILITY_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <label className="block text-sm">
          <span className="text-slate-400">Facility name</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={facilityName}
            onChange={(e) => setFacilityName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Slug / subdomain</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-slate-100"
            value={slug}
            placeholder={computedSlug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>

        {(facilityType === "hospital" || facilityType === "clinic" || facilityType === "health_centre" || facilityType === "laboratory") && (
          <>
            <label className="block text-sm">
              <span className="text-slate-400">Ownership</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                value={ownership}
                onChange={(e) => setOwnership(e.target.value as FacilityOwnership)}
              >
                {FACILITY_OWNERSHIP.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            {facilityType === "hospital" ? (
              <label className="block text-sm">
                <span className="text-slate-400">Facility level</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  value={facilityLevel}
                  onChange={(e) => {
                    const level = e.target.value as FacilityLevel
                    setFacilityLevel(level)
                    setModules(defaultModulesForFacilityType("hospital", level))
                  }}
                >
                  {FACILITY_LEVELS.filter((l) => !["CLINIC", "HEALTH_CENTRE"].includes(l)).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={includeLab} onChange={(e) => setIncludeLab(e.target.checked)} />
                  Include lab
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeDispensing}
                    onChange={(e) => setIncludeDispensing(e.target.checked)}
                  />
                  Include dispensing
                </label>
              </div>
            )}
          </>
        )}

        {facilityType === "laboratory" ? (
          <div className="space-y-4">
            <label className="block text-sm"><span className="text-slate-400">Laboratory profile</span><select className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={laboratoryType} onChange={(e) => setLaboratoryType(e.target.value)}><option value="GENERAL_DIAGNOSTIC">General Diagnostic Laboratory</option><option value="REFERENCE">Reference Laboratory</option><option value="HOSPITAL_INDEPENDENT">Hospital-Independent Laboratory</option><option value="SPECIALIST">Specialist Laboratory</option><option value="COLLECTION_CENTRE">Collection Centre</option><option value="RESEARCH">Research Laboratory</option></select></label>
            <label className="block text-sm"><span className="text-slate-400">Laboratory license number</span><input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} /></label>
            <label className="block text-sm"><span className="text-slate-400">Regulatory / registration number</span><input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={regulatoryNumber} onChange={(e) => setRegulatoryNumber(e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm"><span className="text-slate-400">Accreditation status</span><select className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={accreditationStatus} onChange={(e) => setAccreditationStatus(e.target.value)}><option value="UNKNOWN">Unknown</option><option value="NOT_ACCREDITED">Not Accredited</option><option value="IN_PROGRESS">In Progress</option><option value="ACCREDITED">Accredited</option></select></label><label className="block text-sm"><span className="text-slate-400">Accreditation identifier (optional)</span><input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={accreditationIdentifier} onChange={(e) => setAccreditationIdentifier(e.target.value)} /></label></div>
            <fieldset><legend className="text-sm text-slate-400">Lab sections</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{LAB_SECTION_OPTIONS.map(([key, label]) => <label key={key} className="inline-flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={laboratorySections.includes(key)} onChange={() => setLaboratorySections((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key])} />{label}</label>)}</div></fieldset>
          </div>
        ) : facilityType === "pharmacy" ? (
          <label className="block text-sm">
            <span className="text-slate-400">License number</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
            />
          </label>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-400">City</span>
            <input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">District</span>
            <input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={district} onChange={(e) => setDistrict(e.target.value)} />
          </label>
        </div>

        {facilityType === "laboratory" ? <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm"><span className="text-slate-400">Facility phone</span><input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={facilityPhone} onChange={(e) => setFacilityPhone(e.target.value)} /></label><label className="block text-sm"><span className="text-slate-400">Facility email</span><input type="email" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={facilityEmail} onChange={(e) => setFacilityEmail(e.target.value)} /></label><label className="block text-sm sm:col-span-2"><span className="text-slate-400">Address</span><input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={physicalAddress} onChange={(e) => setPhysicalAddress(e.target.value)} /></label></div> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-400">Administrator name</span>
            <input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Administrator email</span>
            <input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-slate-400">Modules</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {moduleCatalog.map((m) => (
              <label key={m.key} className="inline-flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={modules.includes(m.key)}
                  disabled={m.key === "core" || m.key === "pharmacy_core"}
                  onChange={() =>
                    setModules((prev) =>
                      prev.includes(m.key) ? prev.filter((k) => k !== m.key) : [...prev, m.key],
                    )
                  }
                />
                {m.label}
              </label>
            ))}
          </div>
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Subscription tier</span>
          <select className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-slate-400">Payment status</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={paymentStatus}
            onChange={(e) =>
              setPaymentStatus(
                e.target.value as "ONLINE_REQUIRED" | "OFFLINE_RECEIVED" | "PENDING" | "COMPLIMENTARY",
              )
            }
          >
            <option value="ONLINE_REQUIRED">Online payment required</option>
            <option value="OFFLINE_RECEIVED">Offline payment received</option>
            <option value="PENDING">Payment pending</option>
            <option value="COMPLIMENTARY">Complimentary / pilot</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Offline payment received opens the facility Subscription tab after provisioning so you can
            record cash/bank/MoMo against the canonical plan.
          </p>
        </label>
      </div>

      {error ? (
        <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-100">
          <p className="font-semibold">Provisioning failed</p>
          {result?.failureStep ? <p>Step: <span className="font-mono">{result.failureStep}</span></p> : null}
          {result?.failureCode ? <p>Code: <span className="font-mono">{result.failureCode}</span></p> : null}
          <p>Reason: {result?.failureReason || error}</p>
          {result?.correlationId ? <p className="text-xs">Correlation ID: {result.correlationId}</p> : null}
          <div className="flex gap-2 pt-1">
            {result?.runId ? (
              <button type="button" onClick={retry} className="rounded-md border border-red-400/40 px-3 py-1 text-xs font-semibold">
                Retry
              </button>
            ) : null}
            {result?.runId ? (
              <a href={`/platform/facilities/${result.id ?? ""}?runId=${result.runId}`} className="rounded-md border border-red-400/40 px-3 py-1 text-xs font-semibold">
                Open provisioning details
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        disabled={submitting}
        onClick={submit}
        className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-[#07070A] disabled:opacity-60"
      >
        {submitting ? "Provisioning…" : "Provision facility"}
      </button>
    </div>
  )
}
