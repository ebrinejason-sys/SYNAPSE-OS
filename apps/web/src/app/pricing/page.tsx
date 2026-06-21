import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pricing · Synapse OS',
  description: 'Simple, affordable HMIS + pharmacy plans for African healthcare providers. Pay monthly via MTN MoMo, Airtel, or card.',
}

// ── Pharmacy plans ────────────────────────────────────────────────────────────
// Seeded in supabase/migrations/20260620000001_subscription_billing_flutterwave.sql
// Slugs: pharmacy_starter · pharmacy_growth · pharmacy_multi_branch
const pharmacyPlans = [
  {
    slug: 'pharmacy_starter',
    name: 'Starter',
    priceUgx: 250_000,
    priceUsdRef: 29,
    tagline: 'Launch your pharmacy',
    highlight: false,
    features: [
      '1 location',
      '1 admin + 2 staff accounts',
      'Point of Sale (POS)',
      'Inventory management',
      'Printed receipts & invoices',
      'Basic sales reports',
      'Email + chat support',
    ],
  },
  {
    slug: 'pharmacy_growth',
    name: 'Growth',
    priceUgx: 750_000,
    priceUsdRef: 59,
    tagline: 'Scale your pharmacy network',
    highlight: true,
    features: [
      '3 locations',
      '1 admin + 5 staff accounts',
      'Full POS + inventory',
      'Supplier order management',
      'WhatsApp refill reminders',
      'Advanced analytics & reports',
      'Synapse patient network listing',
      'Priority support',
    ],
  },
  {
    slug: 'pharmacy_multi_branch',
    name: 'Multi-Branch',
    priceUgx: 1_500_000,
    priceUsdRef: 99,
    tagline: 'For chains & distributors',
    highlight: false,
    features: [
      'Unlimited locations',
      'Unlimited staff accounts',
      'Multi-branch inventory & transfers',
      'API access',
      'Custom integrations support',
      'Dedicated account manager',
      'WhatsApp + phone priority support',
      'All Growth features',
    ],
  },
] as const

// ── Hospital HMIS plans ───────────────────────────────────────────────────────
// Contact sales for a custom quote — these are reference prices.
const hmisPlan = {
  features: [
    'Patient registration & EMR',
    'Outpatient & inpatient management',
    'Lab & radiology module',
    'Pharmacy dispensing integration',
    'Billing & insurance claims',
    'Role-based staff access',
    'Analytics & MOH reports',
    'Data sovereignty (Uganda servers)',
  ],
}

function formatUgx(n: number) {
  return `UGX ${n.toLocaleString('en-UG')}`
}

function Check() {
  return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#07070A] text-white">
      {/* ── Header ── */}
      <section className="mx-auto max-w-4xl px-6 pb-12 pt-20 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E8B84B]">Pricing</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Affordable plans for African healthcare
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          Pay monthly via MTN MoMo, Airtel Money, or card — no long-term contracts. Less than hiring
          an extra staff member.
        </p>
      </section>

      {/* ── Pharmacy Plans ── */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F97316]">
            Synapse Pharmacy
          </p>
          <h2 className="mt-2 text-2xl font-bold">Pharmacy management plans</h2>
          <p className="mt-2 text-sm text-slate-500">
            Full POS, inventory, supplier orders, and SMS refill reminders.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {pharmacyPlans.map((plan) => (
            <div
              key={plan.slug}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlight
                  ? 'border-[#E8B84B]/50 bg-gradient-to-b from-[#0E0E14] to-[#111117]'
                  : 'border-slate-800 bg-[#111117]'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[#E8B84B]/40 bg-[#E8B84B]/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#E8B84B]">
                  Most popular
                </div>
              )}

              <p className="text-lg font-bold">{plan.name}</p>
              <p className="mt-0.5 text-sm text-slate-500">{plan.tagline}</p>

              <div className="mt-4">
                <p className="font-mono text-3xl font-bold">{formatUgx(plan.priceUgx)}</p>
                <p className="text-xs text-slate-500">per month · ~${plan.priceUsdRef} USD</p>
              </div>

              <ul className="mt-6 grow space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/pharmacy/register"
                className={`mt-6 block rounded-xl px-5 py-3 text-center text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-[#E8B84B] text-black hover:bg-[#d4a63e]'
                    : 'bg-[#F97316] text-black hover:bg-[#EA6500]'
                }`}
              >
                Start free trial
              </Link>
            </div>
          ))}
        </div>

        {/* Transaction fee footnote */}
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-slate-500">
          A <strong className="text-slate-400">0.5% transaction fee</strong> applies on monthly POS
          volume above UGX 3,700,000 (~$1,000). Pharmacies below the threshold pay only their plan
          subscription.
        </p>
      </section>

      {/* ── Hospital HMIS ── */}
      <section className="border-t border-slate-800 bg-[#0B0B10] py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">
              Synapse HMIS
            </p>
            <h2 className="mt-2 text-2xl font-bold">Hospital information management</h2>
            <p className="mt-2 text-sm text-slate-500">
              Full-facility HMIS for Ugandan hospitals — contact sales for a custom quote based on bed
              count and module selection.
            </p>
          </div>

          <div className="mx-auto max-w-lg rounded-2xl border border-slate-700 bg-[#111117] p-8">
            <p className="text-2xl font-bold">Custom pricing</p>
            <p className="mt-1 text-sm text-slate-500">Based on facility size &amp; modules</p>

            <ul className="mt-6 space-y-2.5">
              {hmisPlan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                  <Check />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="mailto:sales@synapseos.tech?subject=HMIS%20Pricing%20Enquiry"
              className="mt-8 block rounded-xl border border-[#E8B84B]/40 bg-[#E8B84B]/10 px-5 py-3 text-center text-sm font-semibold text-[#E8B84B] transition-colors hover:bg-[#E8B84B]/20"
            >
              Contact sales → sales@synapseos.tech
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-8 text-center text-xl font-bold">Common questions</h2>
        <div className="space-y-6 text-sm">
          {[
            {
              q: 'How do I pay?',
              a: 'MTN Mobile Money, Airtel Money, Visa/Mastercard, or bank transfer for annual plans. All processed securely via Flutterwave.',
            },
            {
              q: 'Can I switch plans?',
              a: 'Yes — upgrade or downgrade anytime from your billing page. Changes take effect at the next billing cycle.',
            },
            {
              q: 'Is there a free trial?',
              a: 'Yes — all pharmacy plans start with a 14-day free trial. No credit card required to start.',
            },
            {
              q: 'What is the transaction fee?',
              a: 'Pharmacies with monthly POS sales above UGX 3,700,000 (~$1,000 USD) pay a 0.5% fee on volume above that threshold. This is passive and billed automatically each month.',
            },
            {
              q: 'Is my data stored in Uganda?',
              a: "Yes. Synapse OS stores all patient and transaction data on Ugandan servers, complying with Uganda's Data Protection and Privacy Act 2019.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-xl border border-slate-800 bg-[#111117] p-5">
              <p className="font-semibold">{q}</p>
              <p className="mt-1.5 text-slate-400">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-slate-800 py-16 text-center">
        <h2 className="text-2xl font-bold">Ready to digitise your pharmacy?</h2>
        <p className="mt-2 text-slate-400">Start your 14-day free trial — no card needed.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link
            href="/pharmacy/register"
            className="rounded-xl bg-[#F97316] px-6 py-3 text-sm font-semibold text-black hover:bg-[#EA6500]"
          >
            Start free trial
          </Link>
          <a
            href="mailto:sales@synapseos.tech"
            className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 hover:border-slate-600 hover:text-white"
          >
            Talk to sales
          </a>
        </div>
      </section>
    </main>
  )
}
