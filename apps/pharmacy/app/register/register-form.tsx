"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { UGANDA_DISTRICTS } from "@synapse/config/constants"
import { SynapseMark } from "@/components/brand/synapse-mark"
import { formatUgx } from "@/lib/format-ugx"

type PlanOption = {
  slug: string
  name: string
  price_ugx: number
  billing_cycle: string
}

const FALLBACK_PLANS: PlanOption[] = [
  { slug: "pharm_monthly", name: "Pharm Monthly", price_ugx: 20000, billing_cycle: "monthly" },
  { slug: "pharm_quarterly", name: "Pharm Quarterly", price_ugx: 52000, billing_cycle: "quarterly" },
  { slug: "pharm_yearly", name: "Pharm Yearly", price_ugx: 200000, billing_cycle: "yearly" },
]

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "")
  if (digits.startsWith("+256")) return digits
  if (digits.startsWith("256")) return `+${digits}`
  if (digits.startsWith("0") && digits.length === 10) return `+256${digits.slice(1)}`
  if (/^7\d{8}$/.test(digits)) return `+256${digits}`
  return digits
}

export default function RegisterForm({ plans }: { plans: PlanOption[] }) {
  const searchParams = useSearchParams()
  const initialPlan = searchParams.get("plan") ?? "pharm_monthly"
  const planList = plans.length > 0 ? plans : FALLBACK_PLANS

  const [step, setStep] = useState(1)
  const [pharmacyName, setPharmacyName] = useState("")
  const [licenseNumber, setLicenseNumber] = useState("")
  const [district, setDistrict] = useState("")
  const [physicalAddress, setPhysicalAddress] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("+256")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [planSlug, setPlanSlug] = useState(
    planList.some((p) => p.slug === initialPlan) ? initialPlan : "pharm_monthly",
  )
  const [pdpoConsent, setPdpoConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedPlan = useMemo(
    () => planList.find((p) => p.slug === planSlug) ?? planList[0],
    [planList, planSlug],
  )

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!pharmacyName.trim()) return "Pharmacy name is required."
      if (!licenseNumber.trim()) return "Licence number is required."
      if (!district) return "Select a district."
      if (!physicalAddress.trim()) return "Physical address is required."
    }
    if (s === 2) {
      if (!fullName.trim()) return "Full name is required."
      const normalized = normalizePhone(phone)
      if (!/^\+2567\d{8}$/.test(normalized)) {
        return "Phone must be +2567XXXXXXXX."
      }
      if (!email.includes("@")) return "Enter a valid email."
      if (password.length < 8) return "Password must be at least 8 characters."
    }
    if (s === 3) {
      if (!planSlug) return "Select a plan."
      if (!pdpoConsent) return "You must consent under the PDPO to continue."
    }
    return null
  }

  const next = () => {
    const err = validateStep(step)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep((v) => Math.min(3, v + 1))
  }

  const submit = async () => {
    const err = validateStep(3)
    if (err) {
      setError(err)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pharmacyName,
          licenseNumber,
          district,
          physicalAddress,
          fullName,
          phone: normalizePhone(phone),
          email,
          password,
          planSlug,
          pdpoConsent,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        redirect?: string
      }
      if (!res.ok) {
        setError(data.error ?? "Registration failed.")
        setLoading(false)
        return
      }
      window.location.assign(data.redirect ?? "/portal/dashboard")
    } catch {
      setError("Network error. Try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07070A] text-[#F5F5F7]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 10% 0%, rgba(31,166,166,0.14), transparent 55%), radial-gradient(ellipse 50% 30% at 100% 20%, rgba(249,115,22,0.1), transparent 50%)",
        }}
      />

      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <SynapseMark className="h-8 w-8" />
          <span className="font-display font-bold">
            Synapse <span className="text-[#1FA6A6]">Pharm</span>
          </span>
        </Link>
        <Link href="/login" className="font-mono text-xs uppercase tracking-wider text-zinc-400">
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#E8B84B]">
          Register · Step {step} of 3
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
          {step === 1 && "Pharmacy details"}
          {step === 2 && "Owner account"}
          {step === 3 && "Plan & consent"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          14-day free trial. No card required.
        </p>

        <div className="mt-8 space-y-4 rounded-2xl border border-[#2A2A36] bg-[#111117] p-5 sm:p-6">
          {step === 1 && (
            <>
              <Field label="Pharmacy name" id="pharmacyName">
                <input
                  id="pharmacyName"
                  className="w-full rounded-lg border border-[#2A2A36] bg-[#07070A] px-3 py-2.5 text-sm text-[#F5F5F7] outline-none focus:border-[#1FA6A6]"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  autoComplete="organization"
                  required
                />
              </Field>
              <Field label="NDA / Pharmacy Board licence number" id="license">
                <input
                  id="license"
                  className="w-full rounded-lg border border-[#2A2A36] bg-[#07070A] px-3 py-2.5 text-sm text-[#F5F5F7] outline-none focus:border-[#1FA6A6]"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  required
                />
              </Field>
              <Field label="District" id="district">
                <select
                  id="district"
                  className="w-full rounded-lg border border-[#2A2A36] bg-[#07070A] px-3 py-2.5 text-sm text-[#F5F5F7] outline-none focus:border-[#1FA6A6]"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  required
                >
                  <option value="">Select district</option>
                  {UGANDA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Physical address" id="address">
                <textarea
                  id="address"
                  className="min-h-[88px] w-full rounded-lg border border-[#2A2A36] bg-[#07070A] px-3 py-2.5 text-sm text-[#F5F5F7] outline-none focus:border-[#1FA6A6]"
                  value={physicalAddress}
                  onChange={(e) => setPhysicalAddress(e.target.value)}
                  required
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Full name" id="fullName">
                <input
                  id="fullName"
                  className="w-full rounded-lg border border-[#2A2A36] bg-[#07070A] px-3 py-2.5 text-sm text-[#F5F5F7] outline-none focus:border-[#1FA6A6]"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </Field>
              <Field label="Phone (+256)" id="phone">
                <input
                  id="phone"
                  className="w-full rounded-lg border border-[#2A2A36] bg-[#07070A] px-3 py-2.5 font-mono text-sm text-[#F5F5F7] outline-none focus:border-[#1FA6A6]"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="+2567XXXXXXXX"
                  required
                />
              </Field>
              <Field label="Email" id="email">
                <input
                  id="email"
                  type="email"
                  className="w-full rounded-lg border border-[#2A2A36] bg-[#07070A] px-3 py-2.5 text-sm text-[#F5F5F7] outline-none focus:border-[#1FA6A6]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="Password" id="password">
                <input
                  id="password"
                  type="password"
                  className="w-full rounded-lg border border-[#2A2A36] bg-[#07070A] px-3 py-2.5 text-sm text-[#F5F5F7] outline-none focus:border-[#1FA6A6]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <p className="mt-1.5 font-mono text-[11px] text-zinc-500">
                  Min 8 chars · 1 uppercase · 1 number · 1 special
                </p>
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <fieldset>
                <legend className="mb-3 font-mono text-xs uppercase tracking-wider text-zinc-500">
                  Choose plan
                </legend>
                <div className="space-y-2">
                  {planList.map((p) => (
                    <label
                      key={p.slug}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                        planSlug === p.slug
                          ? "border-[#F97316] bg-[#F97316]/10"
                          : "border-[#2A2A36] hover:border-[#E8B84B]/40"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="plan"
                          checked={planSlug === p.slug}
                          onChange={() => setPlanSlug(p.slug)}
                        />
                        <span>
                          <span className="block font-display font-semibold">{p.name}</span>
                          <span className="font-mono text-[11px] uppercase text-zinc-500">
                            {p.billing_cycle}
                          </span>
                        </span>
                      </span>
                      <span className="font-mono text-sm font-semibold text-[#E8B84B]">
                        {formatUgx(p.price_ugx)}
                      </span>
                    </label>
                  ))}
                </div>
                {selectedPlan ? (
                  <p className="mt-3 text-xs text-zinc-500">
                    Starts as a 14-day trial on {selectedPlan.name}. You won&apos;t be charged until
                    you subscribe after the trial.
                  </p>
                ) : null}
              </fieldset>

              <label className="mt-6 flex items-start gap-3 text-sm leading-6 text-zinc-300">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={pdpoConsent}
                  onChange={(e) => setPdpoConsent(e.target.checked)}
                />
                <span>
                  I consent to Synapse Health Technologies Limited processing my personal data
                  under Uganda&apos;s Data Protection and Privacy Act (PDPO), as described in the{" "}
                  <a
                    href="https://synapseos.tech/legal/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1FA6A6] underline-offset-2 hover:underline"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            </>
          )}

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3 pt-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setStep((v) => v - 1)
                }}
                className="rounded-lg border border-[#2A2A36] px-4 py-2.5 text-sm font-semibold text-zinc-300"
              >
                Back
              </button>
            ) : null}
            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                className="flex-1 rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={submit}
                className="flex-1 rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {loading ? "Creating account…" : "Create account & start trial"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function Field({
  label,
  id,
  children,
}: {
  label: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  )
}
