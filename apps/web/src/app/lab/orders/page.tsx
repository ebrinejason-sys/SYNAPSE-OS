"use client"

import { useEffect, useState } from "react"

type Order = {
  id: string
  testName: string
  loincCode: string
  status: string
  urgency: string
  accessionNumber?: string | null
  patientName?: string | null
  synapseId?: string | null
}

export default function LabOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [value, setValue] = useState("6.2")
  const [showReferral, setShowReferral] = useState(false)
  const [creating, setCreating] = useState(false)
  const [referral, setReferral] = useState({ patientName: "", dateOfBirth: "", sex: "F", phone: "", testName: "", loincCode: "", urgency: "ROUTINE", referralSource: "" })

  async function refresh() {
    const res = await fetch("/api/lab/worklist", { cache: "no-store" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string; error?: string }
      setError(data.message ?? data.error ?? "Your account does not have access to this laboratory worklist.")
      return
    }
    const data = (await res.json()) as { orders: Order[] }
    setOrders(data.orders)
    setError(null)
  }

  useEffect(() => {
    refresh().catch(() => setError("Unable to load worklist"))
  }, [])

  async function act(orderId: string, action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/lab/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, action, ...extra }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "action_failed")
      return
    }
    await refresh()
  }

  async function createReferral(event: React.FormEvent) {
    event.preventDefault()
    setCreating(true)
    setError(null)
    const res = await fetch("/api/lab/referral-orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(referral) })
    const data = await res.json().catch(() => ({})) as { error?: string | { formErrors?: string[] } }
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : data.error?.formErrors?.[0] ?? "Could not create the referral order.")
      setCreating(false)
      return
    }
    setReferral({ patientName: "", dateOfBirth: "", sex: "F", phone: "", testName: "", loincCode: "", urgency: "ROUTINE", referralSource: "" })
    setShowReferral(false)
    setCreating(false)
    await refresh()
  }

  return (
    <main className="clinical-page p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-2xl">Synapse Lab worklist</h1>
        <button type="button" onClick={() => setShowReferral((open) => !open)} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black">
          {showReferral ? "Cancel referral" : "New external referral"}
        </button>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-color">
        Order → collection → receipt → result → verification. Verified results are never silently overwritten.
        AI cannot release laboratory results.
      </p>
      {showReferral ? (
        <form onSubmit={createReferral} className="mt-6 grid gap-4 rounded-2xl border border-subtle bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted-color">Patient name<input required value={referral.patientName} onChange={(e) => setReferral({ ...referral, patientName: e.target.value })} className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-primary-color" /></label>
          <label className="text-xs text-muted-color">Date of birth<input type="date" value={referral.dateOfBirth} onChange={(e) => setReferral({ ...referral, dateOfBirth: e.target.value })} className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-primary-color" /></label>
          <label className="text-xs text-muted-color">Sex<select value={referral.sex} onChange={(e) => setReferral({ ...referral, sex: e.target.value })} className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-primary-color"><option value="F">Female</option><option value="M">Male</option></select></label>
          <label className="text-xs text-muted-color">Phone<input value={referral.phone} onChange={(e) => setReferral({ ...referral, phone: e.target.value })} className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-primary-color" /></label>
          <label className="text-xs text-muted-color">Test name<input required value={referral.testName} onChange={(e) => setReferral({ ...referral, testName: e.target.value })} className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-primary-color" placeholder="Full blood count" /></label>
          <label className="text-xs text-muted-color">LOINC code<input required value={referral.loincCode} onChange={(e) => setReferral({ ...referral, loincCode: e.target.value })} className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-primary-color" placeholder="58410-2" /></label>
          <label className="text-xs text-muted-color">Urgency<select value={referral.urgency} onChange={(e) => setReferral({ ...referral, urgency: e.target.value })} className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-primary-color"><option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option><option value="STAT">STAT</option></select></label>
          <label className="text-xs text-muted-color">Referral source<input value={referral.referralSource} onChange={(e) => setReferral({ ...referral, referralSource: e.target.value })} className="mt-1 w-full rounded-lg border border-edge bg-elevated px-3 py-2 text-sm text-primary-color" placeholder="Clinic or clinician" /></label>
          <button type="submit" disabled={creating} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60 sm:col-span-2 lg:col-span-4">{creating ? "Creating order…" : "Register patient and create order"}</button>
        </form>
      ) : null}
      {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}
      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted-color">
          No open lab orders for this facility. Orders from the hospital clinical workflow or external laboratory referrals will appear here.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-subtle bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {order.testName} · {order.loincCode}
                  </p>
                  <p className="text-xs text-muted-color">
                    {order.patientName ?? "Synthetic patient"} · {order.synapseId ?? ""} · {order.status} · {order.urgency}
                  </p>
                  {order.accessionNumber ? (
                    <p className="mt-1 font-mono text-xs text-amber-200">{order.accessionNumber}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-lg border border-edge px-3 py-1 text-xs" onClick={() => act(order.id, "collect")}>
                    Collect
                  </button>
                  <button type="button" className="rounded-lg border border-edge px-3 py-1 text-xs" onClick={() => act(order.id, "receive")}>
                    Receive
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-edge px-3 py-1 text-xs"
                    onClick={() => act(order.id, "enter_result", { value })}
                  >
                    Enter result
                  </button>
                  <button type="button" className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-semibold text-black" onClick={() => act(order.id, "verify")}>
                    Verify
                  </button>
                </div>
              </div>
              <label className="mt-3 block text-xs text-muted-color">
                Result value
                <input
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="ml-2 rounded border border-subtle bg-elevated px-2 py-1 text-primary-color"
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
