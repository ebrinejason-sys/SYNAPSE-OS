'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type LabOrder = {
  id: string
  test_name: string
  loinc_code: string
  workflow_status?: string
  status?: string
}
type Prescription = {
  id: string
  medication_display: string
  dose: string | null
  quantity: number
  status: string
}
type TimelineEvent = {
  id: string
  event_type: string
  title: string
  summary: string | null
  event_date: string
  severity: string | null
  tags: string[] | null
}

type EncounterOrdersPanelProps = {
  slug: string
  encounterId: string
  patientId?: string | null
}

export function EncounterOrdersPanel({ slug, encounterId, patientId }: EncounterOrdersPanelProps) {
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
      <div>
        <h1 className="font-display text-2xl">Clinical orders</h1>
        <p className="mt-2 text-muted-color">Select a patient from the OPD queue to view orders and timeline.</p>
        <Link href={`/os/${slug}/clinical/queue`} className="mt-4 inline-block text-sm text-emerald-300">
          ← OPD queue
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link href={`/os/${slug}/clinical/queue`} className="text-xs text-muted-color hover:text-primary-color">
        ← OPD queue
      </Link>
      <h1 className="mt-2 font-display text-2xl">Clinical orders & timeline</h1>
      <p className="mt-2 text-sm text-muted-color">Encounter {encounterId.slice(0, 8)}…</p>
      {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {patientId ? (
          <Link
            href={`/os/${slug}/encounters/new?patientId=${patientId}`}
            className="rounded-lg border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300"
          >
            Add orders
          </Link>
        ) : null}
        <Link href="/lab/orders" className="rounded-lg border border-indigo-500/40 px-3 py-1 text-xs text-indigo-300">
          Lab worklist
        </Link>
        <Link
          href={`/os/${slug}/clinical/dispense`}
          className="rounded-lg border border-amber-500/40 px-3 py-1 text-xs text-amber-300"
        >
          Pharmacy dispense
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-muted-color">Lab orders</h2>
        <ul className="mt-3 space-y-2">
          {labOrders.map((o) => (
            <li key={o.id} className="clinical-card p-3 text-sm">
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
            <li key={rx.id} className="clinical-card p-3 text-sm">
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
            <li key={ev.id} className="clinical-card p-3 text-sm">
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
    </div>
  )
}
