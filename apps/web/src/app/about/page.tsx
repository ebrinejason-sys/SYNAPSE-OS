import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingNav } from '../../components/landing/LandingNav'
import { LandingFooter } from '../../components/landing/LandingFooter'
import { COMPANY, PUBLIC_CONTACT_EMAIL } from '@synapse/config/company'

export const metadata: Metadata = {
  title: 'About · SYNAPSE',
  description: COMPANY.tagline,
  alternates: { canonical: 'https://synapseos.tech/about' },
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      <LandingNav />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E8B84B]">About</p>
        <h1 className="mt-3 text-4xl font-bold">{COMPANY.brandName}</h1>
        <p className="mt-4 text-lg text-slate-300">{COMPANY.tagline}</p>
        <p className="mt-6 text-sm leading-relaxed text-slate-400">
          {COMPANY.legalName} builds connected healthcare infrastructure for African healthcare
          environments — clinical care, laboratories, pharmacies, operations, and health information
          on one interoperable platform. We do not claim certifications or national adoption we have
          not earned.
        </p>
        <p className="mt-4 text-sm text-slate-400">Based in {COMPANY.location}.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/book-meeting" className="rounded-xl bg-[#F97316] px-5 py-3 text-sm font-semibold text-black">
            Book a Meeting
          </Link>
          <a href={`mailto:${PUBLIC_CONTACT_EMAIL}`} className="rounded-xl border border-slate-700 px-5 py-3 text-sm">
            {PUBLIC_CONTACT_EMAIL}
          </a>
        </div>
      </section>
      <LandingFooter />
    </main>
  )
}
