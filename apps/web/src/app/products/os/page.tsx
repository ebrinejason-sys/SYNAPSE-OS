import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingNav } from '../../../components/landing/LandingNav'
import { LandingFooter } from '../../../components/landing/LandingFooter'
import { PUBLIC_CONTACT_EMAIL } from '@synapse/config/company'
import {
  formatUgxAnnual,
  FALLBACK_PUBLIC_PLANS,
  findPlanBySlug,
  CANONICAL_PLAN_SLUGS,
} from '@synapse/db/commercial-pricing'

export const metadata: Metadata = {
  title: 'SYNAPSE OS · Product',
  description:
    'Connected facility and hospital platform — starting at UGX 1,500,000/year. Enterprise uses Book a Meeting.',
  alternates: { canonical: 'https://synapseos.tech/products/os' },
}

const plan = findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.osBasic)!

export default function OsProductPage() {
  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      <LandingNav />
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E8B84B]">SYNAPSE OS</p>
        <h1 className="mt-3 text-4xl font-bold">Connected clinical and facility operations</h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Patient registration, Synapse ID, reception, triage, encounters, documentation, orders,
          billing, referrals, consent, pathways, and role-based access — one interoperable facility
          platform.
        </p>
        <p className="mt-4 font-mono text-2xl text-[#E8B84B]">
          {formatUgxAnnual(plan.priceUgx, plan.pricingState)}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/book-meeting?product=os"
            className="rounded-xl bg-[#F97316] px-5 py-3 text-sm font-semibold text-black"
          >
            Get Started
          </Link>
          <Link
            href="/book-meeting?product=enterprise"
            className="rounded-xl border border-[#E8B84B]/40 px-5 py-3 text-sm text-[#E8B84B]"
          >
            Enterprise — Book a Meeting
          </Link>
          <Link href="/pricing" className="rounded-xl border border-slate-700 px-5 py-3 text-sm">
            View pricing
          </Link>
        </div>
        <ul className="mt-10 grid gap-2 sm:grid-cols-2">
          {plan.featureList.map((f) => (
            <li key={f} className="rounded-lg border border-slate-800 bg-[#111117] px-4 py-3 text-sm text-slate-300">
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-slate-500">
          Questions? <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`}>{PUBLIC_CONTACT_EMAIL}</a>
        </p>
      </section>
      <LandingFooter />
    </main>
  )
}
