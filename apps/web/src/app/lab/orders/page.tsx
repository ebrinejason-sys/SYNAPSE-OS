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

  async function refresh() {
    const res = await fetch("/api/lab/worklist", { cache: "no-store" })
    if (!res.ok) {
      setError("Sign in as hospital lab staff or platform admin to load the worklist.")
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

  return (
    <main className="clinical-page p-8">
      <h1 className="font-display text-2xl">Synapse Lab worklist</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-color">
        Order → collection → receipt → result → verification. Verified results are never silently overwritten.
        AI cannot release laboratory results.
      </p>
      {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}
      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted-color">
          No open lab orders. Place orders from an OPD encounter (/os/[slug]) — hospital lab staff see production worklist rows here.
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
