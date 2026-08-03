import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { SynapseMark } from "@/components/brand/synapse-mark"
import { PosMock } from "@/components/landing/pos-mock"
import { PharmParticleField } from "@/components/landing/pharm-particle-field"
import {
  effectiveMonthlyUgx,
  formatUgx,
  savingsVsMonthly,
} from "@/lib/format-ugx"

export const dynamic = "force-dynamic"

const APP_HOSTS = new Set([
  "pharm.synapseos.tech",
  "www.pharm.synapseos.tech",
])

type PlanRow = {
  slug: string
  name: string
  price_ugx: number | string | null
  billing_cycle: string
}

function cleanHost(host: string | null) {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? ""
}

function isManagedHost(host: string) {
  return (
    !host ||
    APP_HOSTS.has(host) ||
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    host === "127.0.0.1"
  )
}

async function loadActivePharmacyPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabaseAdmin
    .from("subscription_plans")
    .select("slug, name, price_ugx, billing_cycle")
    .eq("facility_type", "pharmacy")
    .eq("is_active", true)
    .order("price_ugx", { ascending: true })

  if (error) {
    console.error("[pharm-landing] failed to load plans:", error.message)
    return []
  }
  return (data ?? []) as PlanRow[]
}

function CustomDomainPortal({
  name,
  loginTenant,
}: {
  name: string
  loginTenant: string
}) {
  return (
    <main className="min-h-screen bg-[#07070A] px-4 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl flex-col justify-center">
        <div className="mb-8 flex items-center gap-3">
          <SynapseMark className="h-12 w-12" />
          <div>
            <p className="type-overline text-[#E8B84B]">
              Synapse Pharm
            </p>
            <h1 className="font-display text-heading-1 tracking-tight">{name}</h1>
          </div>
        </div>
        <div className="rounded-2xl border border-[#2A2A36] bg-[#111117] p-6 shadow-xl">
          <p className="type-overline text-zinc-500">Custom domain</p>
          <h2 className="mt-3 font-display text-heading-2 tracking-tight">Your pharmacy portal is connected</h2>
          <p className="mt-3 text-lead text-zinc-400">
            Sign in to manage dispensing, inventory, staff access, and receipts.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/login?tenant=${encodeURIComponent(loginTenant)}`}
              className="rounded-lg bg-[#F97316] px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default async function Page() {
  const headerStore = await headers()
  const host = cleanHost(headerStore.get("host"))

  if (!isManagedHost(host)) {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name, slug, district, phone")
      .eq("facility_type", "pharmacy")
      .eq("is_active", true)
      .eq("custom_domain", host)
      .maybeSingle()

    if (!tenant) redirect("/login")
    return (
      <CustomDomainPortal
        name={tenant.name}
        loginTenant={tenant.slug ?? host}
      />
    )
  }

  const plans = await loadActivePharmacyPlans()
  const monthlyPlan = plans.find((p) => p.billing_cycle === "monthly")
  const monthlyPrice = Number(monthlyPlan?.price_ugx ?? 20000)

  return (
    <div className="relative min-h-screen bg-[#07070A] text-[#F5F5F7]">
      <PharmParticleField />
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(31,166,166,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(232,184,75,0.12), transparent 50%), radial-gradient(ellipse 50% 30% at 50% 100%, rgba(249,115,22,0.08), transparent 60%)",
        }}
      />

      <header className="relative z-[1] mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <SynapseMark className="h-9 w-9" />
          <span className="font-display text-lg font-semibold tracking-tight">
            Synapse <span className="text-[#1FA6A6]">Pharm</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-4">
          <a
            href="/download/android"
            className="hidden font-mono text-xs uppercase tracking-wider text-zinc-400 hover:text-white sm:inline"
          >
            Android APK
          </a>
          <Link
            href="/login"
            className="font-mono text-xs uppercase tracking-wider text-zinc-400 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-[#F97316] px-3.5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Start free trial
          </Link>
        </nav>
      </header>

      {/* Hero — one composition */}
      <section className="relative z-[1] mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-2 lg:items-center lg:pb-24 lg:pt-12">
        <div className="reveal">
          <p className="type-overline text-[#E8B84B]">
            Synapse Pharm
          </p>
          <h1 className="mt-4 font-display text-display-l max-w-display text-balance tracking-tight lg:max-w-none lg:text-display-xl">
            POS + FEFO inventory built for Ugandan pharmacies
          </h1>
          <p className="mt-5 max-w-prose-narrow text-lead text-zinc-400">
            Sell with printed receipts, expire stock before it walks out the door, and keep cashiers
            moving — priced in UGX, timed for Africa/Kampala. Run the counter on Android with the
            Synapse app.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-[#F97316] px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Start free trial
            </Link>
            <a
              href="/download/android"
              className="rounded-lg border border-[#1FA6A6]/50 bg-[#1FA6A6]/10 px-5 py-3 text-sm font-semibold text-[#1FA6A6] hover:border-[#1FA6A6]"
            >
              Download Android APK
            </a>
            <Link
              href="/login"
              className="rounded-lg border border-[#2A2A36] px-5 py-3 text-sm font-semibold text-zinc-200 hover:border-[#E8B84B]/50"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 font-mono text-xs text-zinc-500">
            7-day trial · No card required · Preview APK for cashiers &amp; stock on Android
          </p>
        </div>
        <div className="reveal reveal-delay-1 rounded-2xl border border-[#2A2A36] bg-[#111117]/80 p-3 shadow-2xl">
          <PosMock />
        </div>
      </section>

      {/* Product */}
      <section className="border-t border-[#1C1C24] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="reveal max-w-prose-narrow">
            <p className="type-overline text-[#1FA6A6]">Product</p>
            <h2 className="mt-3 font-display text-heading-1 text-balance tracking-tight">
              What counters actually need
            </h2>
            <p className="mt-3 text-lead text-zinc-400">
              Honest tools for dispensing days — not a hospital HMIS bolted onto a drugstore.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "01 · POS",
                title: "Printed receipts",
                body: "Kampala-time receipt numbers. Cashier sessions stay separate from admin.",
              },
              {
                label: "02 · Inventory",
                title: "FEFO-aware batches",
                body: "Sell earliest-expiry first. Know what's about to go dead on the shelf.",
              },
              {
                label: "03 · Reports",
                title: "Sales you can trust",
                body: "Day/week summaries in UGX integers — built for reconciliation, not vanity dashboards.",
              },
              {
                label: "04 · Staff",
                title: "Roles that stick",
                body: "Owner, cashier, inventory — permissions that match how Ugandan pharmacies actually run.",
              },
            ].map((f) => (
              <article
                key={f.label}
                className="reveal border-t border-[#E8B84B]/35 pt-5"
              >
                <p className="type-overline text-[#E8B84B]">
                  {f.label}
                </p>
                <h3 className="mt-2 font-display text-heading-3 tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-[#1C1C24] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="reveal max-w-2xl">
            <p className="type-overline text-[#F97316]">Pricing</p>
            <h2 className="mt-3 font-display text-heading-1 text-balance tracking-tight">
              Simple UGX plans
            </h2>
            <p className="mt-3 text-lead text-zinc-400">
              7-day free trial on every tier. No card required to start.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.length === 0 ? (
              <p className="text-sm text-zinc-500">Plans are temporarily unavailable. Email hello@synapseos.tech.</p>
            ) : (
              plans.map((plan) => {
                const price = Number(plan.price_ugx ?? 0)
                const monthly = effectiveMonthlyUgx(price, plan.billing_cycle)
                const saving = savingsVsMonthly(price, plan.billing_cycle, monthlyPrice)
                const isMonthly = plan.billing_cycle === "monthly"
                return (
                  <article
                    key={plan.slug}
                    className={`reveal flex flex-col rounded-2xl border p-6 ${
                      isMonthly
                        ? "border-[#F97316]/60 bg-[#111117]"
                        : "border-[#2A2A36] bg-[#0C0C10]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-heading-3 tracking-tight">{plan.name}</h3>
                        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-zinc-500">
                          {plan.billing_cycle}
                        </p>
                      </div>
                      {saving != null && saving > 0 ? (
                        <span className="rounded-md bg-[#1FA6A6]/15 px-2 py-1 font-mono text-[11px] font-semibold text-[#1FA6A6]">
                          Save {formatUgx(saving)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-6 font-display text-heading-1 tabular-nums tracking-tight text-white">
                      {formatUgx(price)}
                    </p>
                    {!isMonthly ? (
                      <p className="mt-1 font-mono text-xs text-zinc-500">
                        ≈ {formatUgx(monthly)} / month
                      </p>
                    ) : (
                      <p className="mt-1 font-mono text-xs text-zinc-500">per month</p>
                    )}
                    <ul className="mt-6 flex-1 space-y-2 text-sm text-zinc-400">
                      <li>Full POS + FEFO inventory</li>
                      <li>Printed receipts · staff roles</li>
                      <li>7-day free trial</li>
                    </ul>
                    <Link
                      href={`/register?plan=${encodeURIComponent(plan.slug)}`}
                      className={`mt-8 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                        isMonthly
                          ? "bg-[#F97316] text-white hover:bg-orange-600"
                          : "border border-[#2A2A36] text-zinc-100 hover:border-[#E8B84B]/50"
                      }`}
                    >
                      Start free trial
                    </Link>
                  </article>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* How onboarding works */}
      <section className="border-t border-[#1C1C24] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="reveal max-w-prose-narrow">
            <p className="type-overline text-[#E8B84B]">
              How it works
            </p>
            <h2 className="mt-3 font-display text-heading-1 text-balance tracking-tight">
              Three steps to your first sale
            </h2>
          </div>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              { n: "1", t: "Register pharmacy", d: "Licence number, district, owner account — with PDPO consent." },
              { n: "2", t: "Load products", d: "Import or add stock with batch numbers and expiry dates." },
              { n: "3", t: "Sell", d: "Open a cashier session and complete a FEFO-aware sale." },
            ].map((s) => (
              <li key={s.n} className="reveal">
                <span className="font-display text-heading-1 tabular-nums text-[#1FA6A6]">{s.n}</span>
                <h3 className="mt-3 font-display text-heading-3 tracking-tight">{s.t}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Compliance */}
      <section className="border-t border-[#1C1C24] px-4 py-12 sm:px-6">
        <div className="reveal mx-auto max-w-6xl rounded-2xl border border-[#2A2A36] bg-[#0C0C10] px-6 py-8 sm:px-8">
          <p className="type-overline text-zinc-500">Compliance</p>
          <p className="mt-3 max-w-prose-narrow text-sm leading-7 text-zinc-300">
            Personal data is handled under Uganda&apos;s Data Protection and Privacy Act (PDPO).
            At registration we capture your NDA / Pharmacy Board licence number and require an
            explicit consent checkbox before any account is created.
          </p>
        </div>
      </section>

      <footer className="border-t border-[#1C1C24] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <SynapseMark className="h-8 w-8" />
            <div>
              <p className="font-display font-semibold">Synapse Pharm</p>
              <p className="font-mono text-[11px] text-zinc-500">
                Synapse Health Technologies Limited · Uganda
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-wider text-zinc-500">
            <a href="https://synapseos.tech" className="hover:text-[#E8B84B]">
              synapseos.tech
            </a>
            <a href="https://synapseos.tech/legal/privacy" className="hover:text-[#E8B84B]">
              Privacy
            </a>
            <a href="https://synapseos.tech/legal/terms" className="hover:text-[#E8B84B]">
              Terms
            </a>
            <a href="mailto:hello@synapseos.tech" className="hover:text-[#E8B84B]">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
