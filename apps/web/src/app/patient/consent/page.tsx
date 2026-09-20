"use client"

import { useState } from "react"

const PURPOSES = [
  "facility_access",
  "cross_facility_share",
  "research",
  "emergency_profile",
  "blood_donor_contact",
  "dependant_access",
  "insurance_exchange",
  "care_delivery",
  "general_treatment",
  "procedure",
  "surgery",
  "anesthesia",
  "blood_transfusion",
  "hiv_testing",
  "telemedicine",
  "data_sharing",
  "photography_media",
  "records_release",
  "refusal_of_treatment",
  "discharge_ama",
] as const

const COUNTRY_PACKS = [
  { id: "ug-moh-pack", label: "Uganda MoH pack" },
  { id: "ke-moh-pack", label: "Kenya MoH pack" },
  { id: "generic-pack", label: "Generic template pack" },
] as const

const RELATIONSHIPS = ["self", "guardian", "proxy"] as const
const METHODS = ["electronic_ack", "otp", "paper_scan"] as const

type ConsentRow = {
  id?: string
  purpose: string
  status: string
  countryPack?: string | null
  templateVersion?: string | null
  contentHash?: string | null
  signerRelationship?: string | null
}

export default function PatientConsentPage() {
  const [patientId, setPatientId] = useState("")
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]>("general_treatment")
  const [countryPack, setCountryPack] = useState<(typeof COUNTRY_PACKS)[number]["id"]>("generic-pack")
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number]>("self")
  const [method, setMethod] = useState<(typeof METHODS)[number]>("electronic_ack")
  const [witness, setWitness] = useState("")
  const [items, setItems] = useState<ConsentRow[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function load() {
    if (!patientId.trim()) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/patient/consent?patient_id=${encodeURIComponent(patientId.trim())}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`)
      setItems(body.consents ?? [])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setBusy(false)
    }
  }

  async function grant() {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch("/api/patient/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId.trim(),
          purpose,
          country_pack: countryPack,
          signer_relationship: relationship,
          capture_method: method,
          witness_name: witness.trim() || undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : JSON.stringify(body.error))
      setStatus(`Granted ${body.consent.purpose} · hash ${String(body.consent.contentHash).slice(0, 12)}`)
      await load()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  async function withdraw(id: string) {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch("/api/patient/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "withdraw" }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`)
      setStatus("Withdrawn. Prior grant remains auditable.")
      await load()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="clinical-page mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl text-primary-color">Patient Consent Centre</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-color">
        Capture uses versioned country-pack templates. Legal wording is not hardcoded as universal law.
        Withdrawal never deletes a previously signed record.
      </p>

      <label className="clinical-card mt-6 block p-4">
        <span className="text-sm font-medium text-primary-color">Patient ID</span>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="min-w-[16rem] flex-1 rounded-xl border border-subtle bg-base px-3 py-2 text-sm"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            disabled={busy}
          />
          <button type="button" className="rounded-xl border border-subtle px-3 py-2 text-sm" onClick={() => void load()} disabled={busy}>
            Load
          </button>
        </div>
      </label>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void grant()
        }}
      >
        <label className="clinical-card block p-4">
          <span className="text-sm font-medium text-primary-color">Purpose</span>
          <select className="mt-2 w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm" value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)} disabled={busy}>
            {PURPOSES.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="clinical-card block p-4">
          <span className="text-sm font-medium text-primary-color">Country pack</span>
          <select className="mt-2 w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm" value={countryPack} onChange={(e) => setCountryPack(e.target.value as typeof countryPack)} disabled={busy}>
            {COUNTRY_PACKS.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.label}
              </option>
            ))}
          </select>
        </label>
        <label className="clinical-card block p-4">
          <span className="text-sm font-medium text-primary-color">Signer relationship</span>
          <select className="mt-2 w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm" value={relationship} onChange={(e) => setRelationship(e.target.value as typeof relationship)} disabled={busy}>
            {RELATIONSHIPS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="clinical-card block p-4">
          <span className="text-sm font-medium text-primary-color">Capture method</span>
          <select className="mt-2 w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} disabled={busy}>
            {METHODS.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="clinical-card block p-4 sm:col-span-2">
          <span className="text-sm font-medium text-primary-color">Witness name (optional)</span>
          <input className="mt-2 w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm" value={witness} onChange={(e) => setWitness(e.target.value)} disabled={busy} />
        </label>
        <button type="submit" disabled={busy || !patientId.trim()} className="rounded-xl bg-[var(--brand-orange)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40 sm:col-span-2">
          {busy ? "Saving…" : "Grant consent"}
        </button>
      </form>

      {status ? <p className="mt-4 text-sm text-secondary-color">{status}</p> : null}

      <ul className="mt-6 grid gap-3">
        {items.map((item) => (
          <li key={item.id ?? item.purpose} className="clinical-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium capitalize text-primary-color">{item.purpose.replaceAll("_", " ")}</p>
              <span className="text-xs uppercase text-muted-color">{item.status}</span>
            </div>
            <p className="mt-1 text-xs text-muted-color">
              {item.countryPack} · {item.templateVersion} · {item.signerRelationship}
            </p>
            {item.contentHash ? <p className="mt-1 font-mono text-[11px] text-muted-color">{item.contentHash}</p> : null}
            {item.status === "granted" && item.id ? (
              <button type="button" className="mt-3 rounded-xl border border-subtle px-3 py-1.5 text-sm" onClick={() => void withdraw(item.id!)} disabled={busy}>
                Withdraw
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  )
}
