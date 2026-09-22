import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingNav } from '../../../components/landing/LandingNav'
import { LandingFooter } from '../../../components/landing/LandingFooter'
import { COMPANY, PUBLIC_CONTACT_EMAIL } from '@synapse/config/company'
import {
  formatUgxAnnual,
  FALLBACK_PUBLIC_PLANS,
  findPlanBySlug,
  CANONICAL_PLAN_SLUGS,
} from '@synapse/db/commercial-pricing'

export const metadata: Metadata = {
  title: 'SYNAPSE Lab · Product',
  description:
    'Laboratory workflow, specimens, results, devices, and Lab Edge. Standalone UGX 1,000,000/year or +UGX 500,000 with OS.',
  alternates: { canonical: 'https://synapseos.tech/products/lab' },
}

const standalone = findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.lab)!
const addon = findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.osLabAddon)!

export default function LabProductPage() {
  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      <LandingNav />
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">SYNAPSE Lab</p>
        <h1 className="mt-3 text-4xl font-bold">Laboratory and diagnostic operations</h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Orders, specimen lifecycle, results, verification/release, analyzer connectivity, Lab Edge,
          offline queue, and AI-assisted interpretation where supported — with optional SYNAPSE OS
          integration.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-[#111117] p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Standalone Lab</p>
            <p className="mt-2 font-mono text-xl text-[#E8B84B]">
              {formatUgxAnnual(standalone.priceUgx, standalone.pricingState)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#111117] p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Lab add-on for SYNAPSE OS</p>
            <p className="mt-2 font-mono text-xl text-[#E8B84B]">
              {formatUgxAnnual(addon.priceUgx, addon.pricingState)}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/book-meeting?product=lab"
            className="rounded-xl bg-[#F97316] px-5 py-3 text-sm font-semibold text-black"
          >
            Book a Meeting
          </Link>
          <a href={COMPANY.domains.lab} className="rounded-xl border border-slate-700 px-5 py-3 text-sm">
            lab.synapseos.tech
          </a>
          <Link href="/pricing" className="rounded-xl border border-slate-700 px-5 py-3 text-sm">
            View pricing
          </Link>
        </div>
        <ul className="mt-10 grid gap-2 sm:grid-cols-2">
          {standalone.featureList.map((f) => (
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
