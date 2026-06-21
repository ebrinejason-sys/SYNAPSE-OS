'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CreditCard, AlertTriangle, CheckCircle2, Loader2, MessageSquare, TrendingUp, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Subscription = {
  status: string
  planSlug: string | null
  planName: string | null
  priceUgx: number | null
  currentPeriodEnd: string | null
  graceUntil: string | null
  lastPaymentAt: string | null
  cancelAtPeriodEnd?: boolean
}

type Payment = {
  id: string
  amount_ugx: number
  status: string
  method: string | null
  provider_tx_ref: string | null
  created_at: string
  confirmed_at: string | null
}

// ── Pharmacy pricing tiers ────────────────────────────────────────────────────
// Synapse Pharmacy Plans (Uganda market, billed in UGX via MTN MoMo / Airtel)
// USD reference: at ~UGX 3,700/USD exchange rate (June 2026)
//
// DB slugs match subscription_plans seeds in migration 20260620000001.
const PLANS = [
  {
    slug: 'pharmacy_starter',
    name: 'Starter',
    priceUgx: 250_000,
    priceUsdRef: 29,
    billing: 'per month',
    tagline: 'Launch your pharmacy on Synapse',
    features: [
      '1 location',
      '1 admin + 2 staff accounts',
      'Point of Sale (POS)',
      'Inventory management',
      'Printed receipts',
      'Basic reports',
    ],
    highlight: false,
  },
  {
    slug: 'pharmacy_growth',
    name: 'Growth',
    priceUgx: 750_000,
    priceUsdRef: 59,
    billing: 'per month',
    tagline: 'Scale your pharmacy network',
    features: [
      '3 locations',
      '1 admin + 5 staff accounts',
      'Full POS + inventory',
      'Supplier orders & restock',
      'WhatsApp refill alerts',
      'Advanced analytics & reports',
      'Synapse Network listing',
    ],
    highlight: true,
  },
  {
    slug: 'pharmacy_multi_branch',
    name: 'Multi-Branch',
    priceUgx: 1_500_000,
    priceUsdRef: 99,
    billing: 'per month',
    tagline: 'For pharmacy chains & distributors',
    features: [
      'Unlimited locations',
      'Unlimited staff',
      'Multi-branch inventory & transfers',
      'API access',
      'Priority support (WhatsApp & phone)',
      'All Growth features',
    ],
    highlight: false,
  },
] as const

type PlanSlug = (typeof PLANS)[number]['slug']

function formatUgx(n: number) {
  return `UGX ${Math.round(n).toLocaleString('en-UG')}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala' })
}

function PlanBadge({ planSlug }: { planSlug: string | null }) {
  const plan = PLANS.find((p) => p.slug === planSlug)
  if (!plan) return null
  return (
    <span className="ml-2 rounded-full border border-[#F97316]/40 bg-[#F97316]/15 px-2 py-0.5 text-xs font-semibold text-[#F97316]">
      {plan.name}
    </span>
  )
}

function StatusBanner({ sub }: { sub: Subscription | null }) {
  if (!sub) return null
  const { status, graceUntil, currentPeriodEnd, cancelAtPeriodEnd } = sub

  if (status === 'suspended' || status === 'cancelled') {
    return (
      <div className="mb-6 flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
        <div>
          <p className="font-semibold text-red-300">Subscription suspended</p>
          <p className="mt-1 text-red-200/80">
            Operational features are paused. Your data is safe — pay below to reactivate instantly.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'past_due' && graceUntil) {
    return (
      <div className="mb-6 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <p className="font-semibold text-amber-300">Payment overdue</p>
          <p className="mt-1 text-amber-200/80">
            Grace period ends {formatDate(graceUntil)}. Pay now to avoid suspension.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'trialing' || status === 'trial') {
    return (
      <div className="mb-6 flex gap-3 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 p-4 text-sm">
        <CreditCard className="h-5 w-5 shrink-0 text-[#E8B84B]" />
        <div>
          <p className="font-semibold text-[#E8B84B]">Trial active</p>
          <p className="mt-1 text-slate-300">
            {currentPeriodEnd ? `Trial ends ${formatDate(currentPeriodEnd)}.` : 'Subscribe before your trial ends to keep full access.'}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'active') {
    return (
      <div className="mb-6 flex gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
        <div>
          <p className="font-semibold text-green-300">
            Subscription active
            {cancelAtPeriodEnd && (
              <span className="ml-2 text-xs font-normal text-amber-300">(cancels at period end)</span>
            )}
          </p>
          <p className="mt-1 text-slate-300">
            Current period ends {formatDate(currentPeriodEnd)}.
          </p>
        </div>
      </div>
    )
  }

  return null
}

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [smsCredits, setSmsCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; plan?: string | null; reason?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const verifyAttempted = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/status')
      if (!res.ok) throw new Error('Failed to load billing')
      const data = await res.json()
      setSubscription(data.subscription)
      setPayments(data.payments ?? [])
      // NOTE: sms_credits column — requires migration: ALTER TABLE tenants ADD COLUMN sms_credits integer DEFAULT 0
      setSmsCredits(data.smsCredits ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle Flutterwave redirect back — verify and activate the payment
  useEffect(() => {
    const transactionId = searchParams.get('transaction_id')
    const txRef = searchParams.get('tx_ref')
    if (!transactionId || verifyAttempted.current) return
    verifyAttempted.current = true

    async function verifyPayment() {
      setVerifying(true)
      try {
        const params = new URLSearchParams({ transaction_id: transactionId! })
        if (txRef) params.set('tx_ref', txRef)
        const res = await fetch(`/api/billing/verify?${params}`)
        const data = await res.json()
        setVerifyResult(data)
        if (data.ok) {
          // Clean up URL params so refresh doesn't re-verify
          router.replace('/portal/billing')
          await load()
        }
      } catch {
        setVerifyResult({ ok: false, reason: 'network_error' })
      } finally {
        setVerifying(false)
      }
    }

    verifyPayment()
  }, [searchParams, router, load])

  useEffect(() => {
    load()
  }, [load])

  async function pay(planSlug: PlanSlug) {
    setPaying(planSlug)
    setError(null)
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payment initiation failed')
      window.location.href = data.paymentLink
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed')
      setPaying(null)
    }
  }

  async function buySmsCredits() {
    setError('SMS credit purchase is coming soon. Contact support@synapseos.tech to top up.')
    // NOTE: Wire this to a Flutterwave payment link for $5 = UGX ~18,500 = 500 SMS credits
    // Credits are marked up 2× on Africa's Talking bulk SMS rates (~UGX 18/SMS → UGX 37/SMS)
  }

  if (loading || verifying) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {verifying ? 'Confirming your payment…' : 'Loading billing…'}
      </div>
    )
  }

  const currentPlanSlug = subscription?.planSlug as PlanSlug | null | undefined

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            Billing &amp; Subscription
            {currentPlanSlug && <PlanBadge planSlug={currentPlanSlug} />}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Pay monthly via MTN MoMo, Airtel Money, or card. Reactivation is instant after payment confirms.
          </p>
        </div>
      </div>

      {/* Payment verification result */}
      {verifyResult && (
        <div
          className={`mb-4 rounded-xl border p-4 text-sm ${
            verifyResult.ok
              ? 'border-green-500/30 bg-green-500/10 text-green-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {verifyResult.ok ? (
            <p>
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
              Payment confirmed!
              {verifyResult.plan ? ` You are now on the ${verifyResult.plan} plan.` : ' Your subscription is now active.'}
            </p>
          ) : (
            <p>
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              Payment verification failed ({verifyResult.reason ?? 'unknown error'}). If you were charged, contact{' '}
              <a href="mailto:support@synapseos.tech" className="underline">support@synapseos.tech</a>.
            </p>
          )}
        </div>
      )}

      <StatusBanner sub={subscription} />

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      {/* Current plan summary */}
      {subscription?.planName && (
        <div className="mb-8 rounded-xl border border-slate-800 bg-[#111117] p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current plan</p>
          <p className="mt-1 text-lg font-semibold">{subscription.planName}</p>
          {subscription.priceUgx != null && (
            <p className="font-mono text-sm text-[#F97316]">{formatUgx(subscription.priceUgx)}/month</p>
          )}
          {subscription.currentPeriodEnd && (
            <p className="mt-1 text-xs text-slate-500">Renews {formatDate(subscription.currentPeriodEnd)}</p>
          )}
        </div>
      )}

      {/* ── Pricing tiers ── */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Plans — billed monthly
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Prices in UGX via MTN MoMo or Airtel Money. USD reference rate shown. Less than hiring one extra staff member.
      </p>
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlanSlug === plan.slug
          const isHighlighted = plan.highlight
          return (
            <div
              key={plan.slug}
              className={`flex flex-col rounded-xl border p-5 ${
                isCurrent
                  ? 'border-[#F97316]/50 bg-[#F97316]/5'
                  : isHighlighted
                    ? 'border-[#E8B84B]/40 bg-[#0E0E14]'
                    : 'border-slate-800 bg-[#111117]'
              }`}
            >
              {isHighlighted && (
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#E8B84B]">Most popular</p>
              )}
              {isCurrent && (
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#F97316]">Current plan</p>
              )}
              <p className="text-base font-bold">{plan.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{plan.tagline}</p>
              <p className="mt-3 font-mono text-2xl font-bold text-white">
                {formatUgx(plan.priceUgx)}
              </p>
              <p className="text-xs text-slate-500">
                {plan.billing} · ~${plan.priceUsdRef} USD
              </p>
              <ul className="mt-4 grow space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => pay(plan.slug as PlanSlug)}
                disabled={paying !== null || isCurrent}
                className={`mt-5 w-full font-semibold ${
                  isCurrent
                    ? 'cursor-default bg-slate-700 text-slate-400'
                    : 'bg-[#F97316] text-black hover:bg-[#EA6500]'
                }`}
              >
                {paying === plan.slug ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCurrent ? (
                  'Current plan'
                ) : currentPlanSlug ? (
                  'Switch plan'
                ) : (
                  'Subscribe'
                )}
              </Button>
            </div>
          )
        })}
      </div>

      {/* ── Transaction fee section ── */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-[#111117] p-5">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-[#E8B84B]" />
          <div>
            <h2 className="text-sm font-semibold">Transaction fee</h2>
            <p className="mt-1 text-sm text-slate-400">
              <span className="font-semibold text-white">0.5%</span> on monthly POS sales volume above{' '}
              <span className="font-mono text-white">UGX 3,700,000</span> (~$1,000 USD). Billed automatically at
              month end. Pharmacies below the threshold pay nothing beyond their subscription.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Example: UGX 10,000,000 monthly sales → 0.5% × (10M − 3.7M) = UGX 31,500 fee.
            </p>
          </div>
        </div>
      </div>

      {/* ── SMS Credits section ── */}
      <div className="mb-10 rounded-xl border border-slate-800 bg-[#111117] p-5">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-[#E8B84B]" />
          <div className="grow">
            <h2 className="text-sm font-semibold">SMS Credits</h2>
            <p className="mt-1 text-sm text-slate-400">
              Send refill reminders, low-stock alerts, and promotions to your customers via SMS.
              Credits never expire.
            </p>
            {/* NOTE: requires migration — ALTER TABLE tenants ADD COLUMN sms_credits integer DEFAULT 0 */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Current balance</p>
                <p className="mt-1 text-xl font-bold">
                  {smsCredits !== null ? smsCredits.toLocaleString() : '—'}{' '}
                  <span className="text-sm font-normal text-slate-400">credits</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">500 credits</p>
                <p className="text-sm font-semibold text-[#F97316]">UGX 18,500 (~$5)</p>
                <Button
                  onClick={buySmsCredits}
                  className="mt-2 bg-slate-700 text-sm text-white hover:bg-slate-600"
                  size="sm"
                >
                  <Zap className="mr-1.5 h-3.5 w-3.5" />
                  Buy 500 credits
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment history ── */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Payment history</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-slate-500">No payments recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-[#07070A] text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-400">{formatDate(p.confirmed_at ?? p.created_at)}</td>
                  <td className="px-4 py-3 font-mono">{formatUgx(p.amount_ugx)}</td>
                  <td className="px-4 py-3 capitalize text-slate-400">{p.method ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.provider_tx_ref ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.status === 'successful'
                          ? 'text-green-400'
                          : p.status === 'pending'
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
