import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  formatUgxAnnual,
  listPublicPricingPlans,
  osWithLabBundlePrice,
  type CommercialPlan,
} from '@synapse/db/commercial-pricing'
import { COMPANY, PUBLIC_CONTACT_EMAIL } from '@synapse/config/company'
import { LandingNav } from '../../components/landing/LandingNav'
import { LandingFooter } from '../../components/landing/LandingFooter'

export const metadata: Metadata = {
  title: 'Pricing · SYNAPSE',
  description:
    'Annual SYNAPSE pricing in UGX for Pharmacy, Lab, OS Basic, and Enterprise. Configurable from Platform Admin.',
  alternates: { canonical: 'https://synapseos.tech/pricing' },
  openGraph: {
    title: 'SYNAPSE Pricing',
    description: 'Annual healthcare SaaS pricing for African facilities.',
    url: 'https://synapseos.tech/pricing',
  },
}

export const dynamic = 'force-dynamic'

function Check() {
  return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
}

function PlanCard({ plan, highlight }: { plan: CommercialPlan; highlight?: boolean }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        highlight
          ? 'border-[#E8B84B]/50 bg-gradient-to-b from-[#0E0E14] to-[#111117]'
          : 'border-slate-800 bg-[#111117]'
      }`}
    >
      <p className="text-lg font-bold text-white">{plan.name}</p>
      <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
      <div className="mt-4">
        <p className="font-mono text-2xl font-bold text-white">
          {formatUgxAnnual(plan.priceUgx, plan.pricingState)}
        </p>
        {plan.pricingState === 'ADD_ON' ? (
          <p className="text-xs text-slate-500">Add-on for SYNAPSE OS — not standalone Lab</p>
        ) : (
          <p className="text-xs text-slate-500">Billed annually · {plan.currency}</p>
        )}
      </div>
      <ul className="mt-6 grow space-y-2">
        {plan.featureList.slice(0, 8).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
            <Check />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={plan.ctaHref || '/book-meeting'}
        className={`mt-6 block rounded-xl px-5 py-3 text-center text-sm font-semibold transition-colors ${
          plan.customQuote || plan.pricingState === 'CUSTOM_QUOTE'
            ? 'border border-[#E8B84B]/40 bg-[#E8B84B]/10 text-[#E8B84B] hover:bg-[#E8B84B]/20'
            : highlight
              ? 'bg-[#E8B84B] text-black hover:bg-[#d4a63e]'
              : 'bg-[#F97316] text-black hover:bg-[#EA6500]'
        }`}
      >
        {plan.ctaLabel || (plan.customQuote ? 'Book a Meeting' : 'Get Started')}
      </Link>
    </div>
  )
}

export default async function PricingPage() {
  const { plans, source } = await listPublicPricingPlans(supabaseAdmin as never)
  const basePlans = plans.filter((p) => p.pricingState !== 'ADD_ON' && p.pricingState !== 'COMING_SOON')
  const addons = plans.filter((p) => p.pricingState === 'ADD_ON')
  const comingSoon = plans.filter((p) => p.pricingState === 'COMING_SOON')
  const bundle = osWithLabBundlePrice(plans)

  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      <LandingNav />
      <section className="mx-auto max-w-4xl px-6 pb-12 pt-16 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E8B84B]">Pricing</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Annual plans for African healthcare</h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          Transparent starting prices in UGX. Enterprise and unfinished modules use Book a Meeting —
          never fabricated list prices.
        </p>
        {source === 'fallback' ? (
          <p className="mt-3 text-xs text-amber-300/80">
            Showing catalog fallback while the live pricing service is unavailable.
          </p>
        ) : null}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {basePlans.map((plan) => (
            <PlanCard
              key={plan.slug}
              plan={plan}
              highlight={plan.slug === 'synapse_os_basic_annual'}
            />
          ))}
        </div>
      </section>

      {addons.length > 0 ? (
        <section className="border-t border-slate-800 bg-[#0B0B10] py-14">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-bold">Module add-ons</h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-500">
              Lab added to an existing SYNAPSE OS facility is priced differently from standalone Lab
              {bundle.labAddon?.priceUgx != null && bundle.standaloneLab?.priceUgx != null
                ? ` (UGX ${bundle.labAddon.priceUgx.toLocaleString('en-UG')}/year vs UGX ${bundle.standaloneLab.priceUgx.toLocaleString('en-UG')}/year).`
                : '.'}
            </p>
            <div className="mx-auto mt-8 grid max-w-3xl gap-6 md:grid-cols-1">
              {addons.map((plan) => (
                <PlanCard key={plan.slug} plan={plan} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {comingSoon.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-center text-xl font-bold">Coming soon</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {comingSoon.map((plan) => (
              <div key={plan.slug} className="rounded-xl border border-slate-800 bg-[#111117] p-5">
                <p className="font-semibold">{plan.name}</p>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <p className="mt-3 text-sm text-[#E8B84B]">Contact us / Custom pricing</p>
                <Link href="/book-meeting" className="mt-3 inline-block text-sm text-[#F97316]">
                  Book a Meeting →
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-slate-800 py-14 text-center">
        <h2 className="text-xl font-bold">Need a custom deployment?</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
          Large hospitals, multisite groups, and complex integrations use SYNAPSE Enterprise —
          Book a Meeting with our team.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/book-meeting?product=enterprise"
            className="rounded-xl bg-[#F97316] px-5 py-3 text-sm font-semibold text-black"
          >
            Book a Meeting
          </Link>
          <a
            href={`mailto:${PUBLIC_CONTACT_EMAIL}`}
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300"
          >
            {PUBLIC_CONTACT_EMAIL}
          </a>
        </div>
        <p className="mt-8 text-xs text-slate-600">{COMPANY.legalName}</p>
      </section>
      <LandingFooter />
    </main>
  )
}
