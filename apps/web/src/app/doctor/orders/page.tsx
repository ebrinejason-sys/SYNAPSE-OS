'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type LabOrder = { id: string; test_name: string; loinc_code: string; workflow_status?: string; status?: string }
type Prescription = { id: string; medication_display: string; dose: string | null; quantity: number; status: string }

function DoctorOrdersInner() {
  const searchParams = useSearchParams()
  const encounterId = searchParams.get('encounterId') ?? ''
  const [labOrders, setLabOrders] = useState<LabOrder[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!encounterId) return
    Promise.all([
      fetch(`/api/opd/lab-orders?encounter_id=${encounterId}`, { credentials: 'include' }),
      fetch(`/api/opd/prescriptions?encounter_id=${encounterId}`, { credentials: 'include' }),
    ])
      .then(async ([labRes, rxRes]) => {
        if (!labRes.ok || !rxRes.ok) {
          setError('Unable to load orders for this encounter.')
          return
        }
        const labData = await labRes.json()
        const rxData = await rxRes.json()
        setLabOrders(labData.orders ?? [])
        setPrescriptions(rxData.prescriptions ?? [])
      })
      .catch(() => setError('Unable to load orders.'))
  }, [encounterId])

  if (!encounterId) {
    return (
      <main className="min-h-screen bg-synapse-950 text-white p-8">
        <h1 className="font-display text-2xl">Clinical Orders</h1>
        <p className="mt-2 text-gray-400">Select a patient from the queue to view orders.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-synapse-950 text-white p-8">
      <h1 className="font-display text-2xl">Clinical Orders</h1>
      <p className="mt-2 text-sm text-gray-400">Encounter {encounterId.slice(0, 8)}…</p>
      {error ? <p className="mt-4 text-amber-300 text-sm">{error}</p> : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-gray-400">Lab orders</h2>
        <ul className="mt-3 space-y-2">
          {labOrders.map((o) => (
            <li key={o.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              {o.test_name} · {o.loinc_code} · {o.workflow_status ?? o.status}
            </li>
          ))}
          {labOrders.length === 0 ? <p className="text-xs text-gray-500">No lab orders.</p> : null}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-gray-400">Prescriptions</h2>
        <ul className="mt-3 space-y-2">
          {prescriptions.map((rx) => (
            <li key={rx.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              {rx.medication_display} · qty {rx.quantity} · {rx.status}
              {rx.dose ? <span className="block text-xs text-gray-400">{rx.dose}</span> : null}
            </li>
          ))}
          {prescriptions.length === 0 ? <p className="text-xs text-gray-500">No prescriptions.</p> : null}
        </ul>
      </section>
    </main>
  )
}

export default function DoctorOrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-synapse-950 text-white p-8">Loading…</div>}>
      <DoctorOrdersInner />
    </Suspense>
  )
}
