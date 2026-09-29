'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Plan = {
  slug: string
  name: string
  priceUgx: number | null
  pricingState: string
  customQuote: boolean
  billingPeriod: string
  facilityType: string
}

type Subscription = {
  id?: string
  status?: string
  payment_status?: string
  activation_source?: string | null
  activated_at?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
  renewal_date?: string | null
  last_payment_at?: string | null
  agreed_price_ugx?: number | null
  agreed_currency?: string | null
  commercial_notes?: string | null
  contract_reference?: string | null
  subscription_plans?: {
    slug?: string
    name?: string
    price_ugx?: number | null
  } | null
}

type Payment = {
  id: string
  amount_ugx: number
  currency?: string
  method?: string | null
  provider?: string | null
  status: string
  provider_tx_ref?: string | null
  period_start?: string | null
  period_end?: string | null
  confirmed_at?: string | null
  created_at?: string
}

type MethodOption = { value: string; label: string }

function daysRemaining(iso?: string | null): string {
  if (!iso) return '—'
  const end = new Date(iso).getTime()
  const days = Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000))
  if (Number.isNaN(days)) return '—'
  if (days < 0) return `Expired ${Math.abs(days)}d ago`
  return `${days}d`
}

function fmt(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'Africa/Kampala',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function FacilitySubscriptionPanel({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState('')
  const [facilityType, setFacilityType] = useState('')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [methods, setMethods] = useState<MethodOption[]>([])
  const [canActivate, setCanActivate] = useState(false)
  const [canOverride, setCanOverride] = useState(false)

  const [planSlug, setPlanSlug] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [amountPaidUgx, setAmountPaidUgx] = useState('')
  const [reference, setReference] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [otherDescription, setOtherDescription] = useState('')
  const [complimentaryReason, setComplimentaryReason] = useState('')
  const [priceOverride, setPriceOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resultMsg, setResultMsg] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [receipt, setReceipt] = useState<{
    invoiceNo: string | null
    facility: string
    plan: string
    amount: string
    method: string
    reference: string
    period: string
    paymentDate: string
  } | null>(null)

  const selectedPlan = useMemo(
    () => plans.find((p) => p.slug === planSlug) ?? null,
    [plans, planSlug],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/subscriptions/manual-activate?tenantId=${tenantId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load subscription')
      setTenantName(data.tenant?.name ?? '')
      setFacilityType(data.tenant?.facility_type ?? '')
      setSubscription(data.subscription)
      setPayments(data.payments ?? [])
      setPlans(data.plans ?? [])
      setMethods(data.paymentMethods ?? [])
      setCanActivate(Boolean(data.capabilities?.canActivate))
      setCanOverride(Boolean(data.capabilities?.canOverridePrice))
      if (!planSlug && data.plans?.[0]?.slug) setPlanSlug(data.plans[0].slug)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [tenantId, planSlug])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  useEffect(() => {
    if (selectedPlan?.priceUgx != null && paymentMethod !== 'COMPLIMENTARY' && !priceOverride) {
      setAmountPaidUgx(String(selectedPlan.priceUgx))
    }
  }, [selectedPlan, paymentMethod, priceOverride])

  async function confirmActivate() {
    if (submitting) return
    setSubmitting(true)
    setResultMsg(null)
    setError(null)
    try {
      const res = await fetch('/api/platform/subscriptions/manual-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          planSlug,
          paymentMethod,
          amountPaidUgx: paymentMethod === 'COMPLIMENTARY' ? 0 : Number(amountPaidUgx),
          reference,
          receivedBy,
          notes,
          otherDescription,
          complimentaryReason,
          priceOverride,
          overrideReason,
          idempotencyKey,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.code || 'Activation failed')
      setResultMsg(
        data.idempotent
          ? 'Already activated (idempotent replay).'
          : `Activated. Period ${fmt(data.periodStart)} → ${fmt(data.periodEnd)}. Payment ${data.paymentId.slice(0, 8)}…`,
      )
      setReceipt({
        invoiceNo: data.invoiceNo ?? data.paymentId?.slice(0, 8)?.toUpperCase() ?? null,
        facility: tenantName,
        plan: selectedPlan?.name ?? planSlug,
        amount:
          paymentMethod === 'COMPLIMENTARY'
            ? 'COMPLIMENTARY'
            : `UGX ${Number(amountPaidUgx || 0).toLocaleString()}`,
        method: methods.find((m) => m.value === paymentMethod)?.label ?? paymentMethod,
        reference: reference || '—',
        period: `${fmt(data.periodStart)} → ${fmt(data.periodEnd)}`,
        paymentDate: new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala' }),
      })
      setConfirmOpen(false)
      setIdempotencyKey(crypto.randomUUID())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading subscription…</p>
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {resultMsg ? (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-200">
          {resultMsg}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-sm font-semibold text-[#E8B84B]">Current subscription</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Facility</dt>
            <dd className="text-slate-100">{tenantName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Type</dt>
            <dd className="capitalize text-slate-100">{facilityType.replace(/_/g, ' ')}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Plan</dt>
            <dd className="text-slate-100">
              {subscription?.subscription_plans?.name ?? subscription?.subscription_plans?.slug ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd className="text-slate-100">{subscription?.status ?? 'none'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Payment status</dt>
            <dd className="text-slate-100">{subscription?.payment_status ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Activation source</dt>
            <dd className="text-slate-100">{subscription?.activation_source ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Period</dt>
            <dd className="text-slate-100">
              {fmt(subscription?.current_period_start)} → {fmt(subscription?.current_period_end)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Days remaining</dt>
            <dd className="text-slate-100">{daysRemaining(subscription?.current_period_end)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Agreed amount (snapshot)</dt>
            <dd className="text-slate-100">
              {subscription?.agreed_price_ugx != null
                ? `${subscription.agreed_currency ?? 'UGX'} ${Number(subscription.agreed_price_ugx).toLocaleString()}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Last payment</dt>
            <dd className="text-slate-100">{fmt(subscription?.last_payment_at)}</dd>
          </div>
        </dl>
      </section>

      {canActivate ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="text-sm font-semibold text-[#E8B84B]">
            Record offline payment / activate subscription
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Quantity of money comes from the canonical plan unless you use an authorized price override.
            Import amount is a receipt — activation uses the shared subscription entitlement system.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">
              Plan
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={planSlug}
                onChange={(e) => setPlanSlug(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                    {p.priceUgx != null ? ` — UGX ${p.priceUgx.toLocaleString()}/${p.billingPeriod}` : ' — custom quote'}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Payment method
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {methods.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            {paymentMethod !== 'COMPLIMENTARY' ? (
              <label className="text-xs text-slate-400">
                Amount paid (UGX)
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={amountPaidUgx}
                  onChange={(e) => setAmountPaidUgx(e.target.value)}
                  disabled={!priceOverride && !selectedPlan?.customQuote}
                />
              </label>
            ) : null}
            <label className="text-xs text-slate-400">
              Reference / receipt number
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-400">
              Received by
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-400 sm:col-span-2">
              Notes
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            {paymentMethod === 'OTHER' ? (
              <label className="text-xs text-slate-400 sm:col-span-2">
                Other method description *
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={otherDescription}
                  onChange={(e) => setOtherDescription(e.target.value)}
                  required
                />
              </label>
            ) : null}
            {paymentMethod === 'COMPLIMENTARY' ? (
              <label className="text-xs text-slate-400 sm:col-span-2">
                Complimentary reason *
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={complimentaryReason}
                  onChange={(e) => setComplimentaryReason(e.target.value)}
                  required
                />
              </label>
            ) : null}
            {canOverride && paymentMethod !== 'COMPLIMENTARY' ? (
              <div className="sm:col-span-2 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <label className="flex items-center gap-2 text-xs text-amber-100">
                  <input
                    type="checkbox"
                    checked={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.checked)}
                  />
                  Authorized price override (discount / negotiated / special arrangement)
                </label>
                {priceOverride ? (
                  <input
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    placeholder="Override reason *"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-[#E8B84B] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              disabled={!planSlug || submitting}
              onClick={() => setConfirmOpen(true)}
            >
              Review &amp; confirm activation
            </button>
          </div>
        </section>
      ) : (
        <p className="text-sm text-slate-500">
          You can view subscription history but lack activation permission.
        </p>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-sm font-semibold text-[#E8B84B]">Payment history</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">When</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Period</th>
                <th>Ref</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-slate-500">
                    No payments recorded.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="py-2">{fmt(p.confirmed_at ?? p.created_at)}</td>
                    <td>
                      {p.currency ?? 'UGX'} {Number(p.amount_ugx).toLocaleString()}
                    </td>
                    <td>{p.method ?? '—'}</td>
                    <td>{p.provider ?? '—'}</td>
                    <td>{p.status}</td>
                    <td>
                      {fmt(p.period_start)} → {fmt(p.period_end)}
                    </td>
                    <td className="font-mono text-[10px]">{p.provider_tx_ref ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-white">Confirm &amp; Activate</h3>
            <p className="mt-2 text-sm text-slate-400">
              This grants paid product access via the canonical ACTIVE subscription.
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Facility</dt>
                <dd className="text-slate-100">{tenantName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Plan</dt>
                <dd className="text-slate-100">{selectedPlan?.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Amount</dt>
                <dd className="text-slate-100">
                  {paymentMethod === 'COMPLIMENTARY'
                    ? 'COMPLIMENTARY (not a UGX 0 cash payment)'
                    : `UGX ${Number(amountPaidUgx || 0).toLocaleString()}`}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Method</dt>
                <dd className="text-slate-100">
                  {methods.find((m) => m.value === paymentMethod)?.label ?? paymentMethod}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Canonical price</dt>
                <dd className="text-slate-100">
                  {selectedPlan?.priceUgx != null
                    ? `UGX ${selectedPlan.priceUgx.toLocaleString()}`
                    : 'Custom quote'}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#E8B84B] px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                onClick={() => void confirmActivate()}
                disabled={submitting}
              >
                {submitting ? 'Activating…' : 'Confirm & Activate'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {receipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 print:static print:bg-white">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-white p-6 text-slate-900 shadow-xl print:border-0 print:shadow-none">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Payment Receipt</p>
                <h3 className="text-xl font-bold">SYNAPSE OS</h3>
              </div>
              <p className="font-mono text-xs text-slate-500">
                {receipt.invoiceNo ? `Receipt ${receipt.invoiceNo}` : 'Receipt'}
              </p>
            </div>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Facility</dt><dd>{receipt.facility}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Plan</dt><dd>{receipt.plan}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Amount</dt><dd>{receipt.amount}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Payment method</dt><dd>{receipt.method}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Reference</dt><dd>{receipt.reference}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Payment date</dt><dd>{receipt.paymentDate}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Subscription period</dt><dd>{receipt.period}</dd></div>
            </dl>
            <div className="mt-6 flex justify-end gap-2 print:hidden">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onClick={() => setReceipt(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => window.print()}
              >
                Print receipt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
