'use client'

import { useCallback, useEffect, useState } from 'react'
import { CreditCard, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Subscription = {
  status: string
  planSlug: string | null
  planName: string | null
  priceUgx: number | null
  currentPeriodEnd: string | null
  graceUntil: string | null
  lastPaymentAt: string | null
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

const PLANS = [
  { slug: 'pharmacy_starter', name: 'Starter', desc: '1 store · POS · inventory · receipts' },
  { slug: 'pharmacy_growth', name: 'Growth', desc: 'Network listing · refills · reports · WhatsApp' },
  { slug: 'pharmacy_multi_branch', name: 'Multi-Branch', desc: 'Multi-location inventory & transfers' },
]

function formatUgx(n: number) {
  return `UGX ${Math.round(n).toLocaleString('en-UG')}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala' })
}

function StatusBanner({ sub }: { sub: Subscription | null }) {
  if (!sub) return null
  const { status, graceUntil, currentPeriodEnd } = sub

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
          <p className="font-semibold text-amber-300">Payment due</p>
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
            {currentPeriodEnd ? `Trial ends ${formatDate(currentPeriodEnd)}.` : 'Subscribe before trial ends to keep access.'}
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
          <p className="font-semibold text-green-300">Subscription active</p>
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
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/status')
      if (!res.ok) throw new Error('Failed to load billing')
      const data = await res.json()
      setSubscription(data.subscription)
      setPayments(data.payments ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

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
      if (!res.ok) throw new Error(data.error ?? 'Payment failed')
      window.location.href = data.paymentLink
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed')
      setPaying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading billing…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Billing & subscription</h1>
      <p className="mt-1 text-sm text-slate-400">
        Pay monthly via MTN MoMo, Airtel Money, or card. Reactivation is instant after payment confirms.
      </p>

      <StatusBanner sub={subscription} />

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      {subscription?.planName && (
        <div className="mb-8 rounded-xl border border-slate-800 bg-[#111117] p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current plan</p>
          <p className="mt-1 text-lg font-semibold">{subscription.planName}</p>
          {subscription.priceUgx != null && (
            <p className="font-mono text-sm text-[#F97316]">{formatUgx(subscription.priceUgx)}/month</p>
          )}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Plans</h2>
      <div className="mb-10 space-y-3">
        {PLANS.map((plan) => (
          <div
            key={plan.slug}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#111117] p-4"
          >
            <div>
              <p className="font-semibold">{plan.name}</p>
              <p className="text-sm text-slate-400">{plan.desc}</p>
            </div>
            <Button
              onClick={() => pay(plan.slug)}
              disabled={paying !== null}
              className="bg-[#F97316] hover:bg-[#EA6500] text-black font-semibold"
            >
              {paying === plan.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay now'}
            </Button>
          </div>
        ))}
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
