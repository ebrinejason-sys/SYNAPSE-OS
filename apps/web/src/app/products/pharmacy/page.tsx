import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingNav } from '../../../components/landing/LandingNav'
import { LandingFooter } from '../../../components/landing/LandingFooter'
import { COMPANY, PUBLIC_CONTACT_EMAIL } from '@synapse/config/company'
import { formatUgxAnnual, FALLBACK_PUBLIC_PLANS, findPlanBySlug, CANONICAL_PLAN_SLUGS } from '@synapse/db/commercial-pricing'

export const metadata: Metadata = {
  title: 'SYNAPSE Pharmacy · Product',
  description:
    'Pharmacy inventory, purchasing, dispensing, POS, and reports — UGX 240,000/year. Application at pharm.synapseos.tech.',
  alternates: { canonical: 'https://synapseos.tech/products/pharmacy' },
}

const plan = findPlanBySlug(FALLBACK_PUBLIC_PLANS, CANONICAL_PLAN_SLUGS.pharmacy)!

export default function PharmacyProductPage() {
  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      <LandingNav />
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F97316]">SYNAPSE Pharmacy</p>
        <h1 className="mt-3 text-4xl font-bold">Pharmacy operations for independent and community pharmacies</h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Inventory, purchasing, suppliers, dispensing, POS/billing, batch/expiry tracking, reports, and
          mobile access where production-supported.
        </p>
        <p className="mt-4 font-mono text-2xl text-[#E8B84B]">{formatUgxAnnual(plan.priceUgx, plan.pricingState)}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={COMPANY.domains.pharmacy}
            className="rounded-xl bg-[#F97316] px-5 py-3 text-sm font-semibold text-black"
          >
            Open Pharmacy app
          </a>
          <Link href="/book-meeting?product=pharmacy" className="rounded-xl border border-slate-700 px-5 py-3 text-sm">
            Contact us
          </Link>
          <Link href="/pricing" className="rounded-xl border border-slate-700 px-5 py-3 text-sm">
            View pricing
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Marketing page: synapseos.tech/products/pharmacy · Application workspace:{' '}
          <a className="text-[#F97316]" href={COMPANY.domains.pharmacy}>
            pharm.synapseos.tech
          </a>
        </p>
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
