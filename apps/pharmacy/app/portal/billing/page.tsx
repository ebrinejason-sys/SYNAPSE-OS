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
  billingCycle: string | null
  trialEnds: string | null
  currentPeriodEnd: string | null
  graceUntil: string | null
  lastPaymentAt: string | null
  cancelAtPeriodEnd?: boolean
}

type Plan = {
  slug: string
  name: string
  price_ugx: number | null
  billing_cycle: string
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

const INCLUDED_FEATURES = [
  'Point of Sale with printed receipts',
  'FEFO expiry-aware batch inventory',
  'Sales reporting & daily summaries',
  'Staff roles & cashier sessions',
] as const

function formatUgx(n: number) {
  return `UGX ${Math.round(n).toLocaleString('en-UG')}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala' })
}

function statusLabel(status: string | null | undefined) {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
      return 'Active'
    case 'trialing':
    case 'trial':
      return 'Trial'
    case 'past_due':
      return 'Past due'
    case 'suspended':
      return 'Suspended'
    case 'cancelled':
    case 'canceled':
      return 'Cancelled'
    default:
      return status ? status.replace(/_/g, ' ') : 'Unknown'
  }
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
            Operational features are paused. Your data is safe — renew the yearly plan below to reactivate.
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
            Grace period ends {formatDate(graceUntil)}. Renew now to avoid suspension.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'trialing' || status === 'trial') {
    const trialEnd = sub.trialEnds ?? currentPeriodEnd
    return (
      <div className="mb-6 flex gap-3 rounded-xl border border-[#E8B84B]/30 bg-[#E8B84B]/10 p-4 text-sm">
        <CreditCard className="h-5 w-5 shrink-0 text-[#E8B84B]" />
        <div>
          <p className="font-semibold text-[#E8B84B]">Trial active</p>
          <p className="mt-1 text-slate-300">
            {trialEnd
              ? `Trial ends ${formatDate(trialEnd)}. Subscribe to the yearly plan to keep full access.`
              : 'Subscribe to the yearly plan before your trial ends to keep full access.'}
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
  const [plans, setPlans] = useState<Plan[]>([])
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
      // API already returns yearly-only; keep a client guard for older responses.
      const yearly = ((data.plans ?? []) as Plan[]).filter((p) => {
        const cycle = (p.billing_cycle ?? '').toLowerCase()
        return cycle === 'yearly' || cycle === 'annual' || p.slug === 'synapse_pharmacy_annual'
      })
      setPlans(yearly.slice(0, 1))
      setPayments(data.payments ?? [])
      setSmsCredits(data.smsCredits ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

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

  async function pay(planSlug: string) {
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
  }

  if (loading || verifying) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {verifying ? 'Confirming your payment…' : 'Loading billing…'}
      </div>
    )
  }

  const yearlyPlan = plans[0] ?? null
  const onYearly =
    !!subscription?.planSlug &&
    (subscription.planSlug === yearlyPlan?.slug ||
      subscription.planSlug === 'synapse_pharmacy_annual' ||
      (subscription.billingCycle ?? '').toLowerCase() === 'yearly' ||
      (subscription.billingCycle ?? '').toLowerCase() === 'annual')
  const isPaidActive = (subscription?.status ?? '').toLowerCase() === 'active'
  const isTrial = ['trialing', 'trial'].includes((subscription?.status ?? '').toLowerCase())
  const needsSubscribe = !subscription || !isPaidActive || isTrial

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Billing &amp; Subscription</h1>
        <p className="mt-1 text-sm text-slate-400">
          Your facility subscription status. Self-serve renewals use the yearly Pharmacy plan (UGX 240,000).
        </p>
      </div>

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

      {/* Active / current facility subscription */}
      <div className="mb-8 rounded-xl border border-[#F97316]/40 bg-[#F97316]/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Active facility subscription</p>
        {subscription ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Plan</p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {subscription.planName ?? 'Pharmacy subscription'}
              </p>
              {subscription.planSlug && (
                <p className="mt-0.5 font-mono text-xs text-slate-500">{subscription.planSlug}</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-1 text-lg font-semibold">{statusLabel(subscription.status)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Amount</p>
              <p className="mt-1 font-mono text-lg text-[#F97316]">
                {subscription.priceUgx != null ? `${formatUgx(subscription.priceUgx)} / year` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {(subscription.status === 'trialing' || subscription.status === 'trial') ? 'Trial ends' : 'Period ends'}
              </p>
              <p className="mt-1 text-lg">
                {formatDate(
                  subscription.status === 'trialing' || subscription.status === 'trial'
                    ? subscription.trialEnds ?? subscription.currentPeriodEnd
                    : subscription.currentPeriodEnd,
                )}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            No subscription on file for this facility yet. Subscribe to the yearly plan below.
          </p>
        )}
      </div>

      {/* Yearly self-serve only */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {needsSubscribe ? 'Yearly subscription' : 'Renew yearly subscription'}
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Monthly and quarterly plans are no longer offered in-app. Pay via MTN MoMo, Airtel Money, or card.
      </p>
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5">
        {INCLUDED_FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-1.5 text-xs text-slate-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
            {f}
          </li>
        ))}
      </ul>

      {!yearlyPlan ? (
        <p className="mb-10 text-sm text-slate-500">
          Yearly plan unavailable — contact support@synapseos.tech.
        </p>
      ) : (
        <div className="mb-10 max-w-md rounded-xl border border-[#E8B84B]/40 bg-[#0E0E14] p-5">
          {onYearly && isPaidActive && (
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#F97316]">Current plan</p>
          )}
          <p className="text-base font-bold">{yearlyPlan.name}</p>
          <p className="mt-3 font-mono text-2xl font-bold text-white">
            {yearlyPlan.price_ugx != null ? formatUgx(yearlyPlan.price_ugx) : 'UGX 240,000'}
          </p>
          <p className="text-xs text-slate-500">per year</p>
          <Button
            onClick={() => pay(yearlyPlan.slug)}
            disabled={paying !== null}
            className="mt-5 w-full font-semibold bg-[#F97316] text-black hover:bg-[#EA6500]"
          >
            {paying === yearlyPlan.slug ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : needsSubscribe ? (
              'Subscribe — yearly'
            ) : onYearly ? (
              'Renew early — yearly'
            ) : (
              'Switch to yearly'
            )}
          </Button>
          {isPaidActive && onYearly && (
            <p className="mt-2 text-xs text-slate-500">
              Early renewal extends your current period from the existing end date.
            </p>
          )}
        </div>
      )}

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
          </div>
        </div>
      </div>

      <div className="mb-10 rounded-xl border border-slate-800 bg-[#111117] p-5">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-[#E8B84B]" />
          <div className="grow">
            <h2 className="text-sm font-semibold">SMS Credits</h2>
            <p className="mt-1 text-sm text-slate-400">
              Send refill reminders, low-stock alerts, and promotions to your customers via SMS.
              Credits never expire.
            </p>
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
