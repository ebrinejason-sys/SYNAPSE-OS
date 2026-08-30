'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type LabOrder = { id: string; test_name: string; loinc_code: string; workflow_status?: string; status?: string }
type Prescription = { id: string; medication_display: string; dose: string | null; quantity: number; status: string }
type TimelineEvent = {
  id: string
  event_type: string
  title: string
  summary: string | null
  event_date: string
  severity: string | null
  tags: string[] | null
}

function DoctorOrdersInner() {
  const searchParams = useSearchParams()
  const encounterId = searchParams.get('encounterId') ?? ''
  const [labOrders, setLabOrders] = useState<LabOrder[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [invoiceTotal, setInvoiceTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!encounterId) return
    Promise.all([
      fetch(`/api/opd/lab-orders?encounter_id=${encounterId}`, { credentials: 'include' }),
      fetch(`/api/opd/prescriptions?encounter_id=${encounterId}`, { credentials: 'include' }),
      fetch(`/api/hospital/timeline/encounter/${encounterId}`, { credentials: 'include' }),
      fetch(`/api/hospital/billing/encounter/${encounterId}`, { credentials: 'include' }),
    ])
      .then(async ([labRes, rxRes, timelineRes, billingRes]) => {
        if (!labRes.ok || !rxRes.ok) {
          setError('Unable to load orders for this encounter.')
          return
        }
        const labData = await labRes.json()
        const rxData = await rxRes.json()
        setLabOrders(labData.orders ?? [])
        setPrescriptions(rxData.prescriptions ?? [])
        if (timelineRes.ok) {
          const tl = await timelineRes.json()
          setTimeline(tl.events ?? [])
        }
        if (billingRes.ok) {
          const bill = await billingRes.json()
          setInvoiceTotal(bill.invoice?.total_amount ?? null)
        }
      })
      .catch(() => setError('Unable to load orders.'))
  }, [encounterId])

  if (!encounterId) {
    return (
      <main className="min-h-screen bg-base text-primary-color p-8">
        <h1 className="font-display text-2xl">Clinical Orders</h1>
        <p className="mt-2 text-muted-color">Select a patient from the queue to view orders.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-base text-primary-color p-8">
      <h1 className="font-display text-2xl">Clinical Orders</h1>
      <p className="mt-2 text-sm text-muted-color">Encounter {encounterId.slice(0, 8)}…</p>
      {error ? <p className="mt-4 text-amber-300 text-sm">{error}</p> : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-muted-color">Lab orders</h2>
        <ul className="mt-3 space-y-2">
          {labOrders.map((o) => (
            <li key={o.id} className="rounded-xl border border-subtle bg-surface p-3 text-sm">
              {o.test_name} · {o.loinc_code} · {o.workflow_status ?? o.status}
            </li>
          ))}
          {labOrders.length === 0 ? <p className="text-xs text-muted-color">No lab orders.</p> : null}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-muted-color">Prescriptions</h2>
        <ul className="mt-3 space-y-2">
          {prescriptions.map((rx) => (
            <li key={rx.id} className="rounded-xl border border-subtle bg-surface p-3 text-sm">
              {rx.medication_display} · qty {rx.quantity} · {rx.status}
              {rx.dose ? <span className="block text-xs text-muted-color">{rx.dose}</span> : null}
            </li>
          ))}
          {prescriptions.length === 0 ? <p className="text-xs text-muted-color">No prescriptions.</p> : null}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-muted-color">Encounter timeline</h2>
        {invoiceTotal != null ? (
          <p className="mt-2 text-xs text-emerald-300">Draft invoice total: UGX {invoiceTotal.toLocaleString()}</p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {timeline.map((ev) => (
            <li key={ev.id} className="rounded-xl border border-subtle bg-surface p-3 text-sm">
              <p className="font-medium">{ev.title}</p>
              {ev.summary ? <p className="text-xs text-muted-color">{ev.summary}</p> : null}
              <p className="mt-1 text-[10px] uppercase text-muted-color">
                {ev.event_type} · {new Date(ev.event_date).toLocaleString()}
              </p>
            </li>
          ))}
          {timeline.length === 0 ? <p className="text-xs text-muted-color">No timeline events yet.</p> : null}
        </ul>
      </section>
    </main>
  )
}

export default function DoctorOrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-base text-primary-color p-8">Loading…</div>}>
      <DoctorOrdersInner />
    </Suspense>
  )
}
