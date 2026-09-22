'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface PurchaseRow {
  id: string
  purchase_no: string
  status: string
  payment_status: string
  total: number
  purchase_date: string | null
  pharmacy_suppliers?: { name?: string } | null
}

export default function HospitalPharmacyPurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/hospital/pharmacy/purchases')
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || `Failed (${res.status})`)
        setPurchases(body.purchases ?? [])
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Purchases</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Hospital pharmacy receipts use the same pharmacy inventory authority as standalone pharmacies.
          New catalog products and batch receiving happen through receive_pharmacy_stock.
        </p>
      </div>
      {loading && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading purchases…</p>}
      {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
      {!loading && !error && purchases.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No pharmacy purchases on this tenant yet. Use the Pharmacy portal New Purchase flow for walk-in receipts.
        </p>
      )}
      <div className="space-y-2">
        {purchases.map((row) => (
          <div key={row.id} className="rounded-2xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{row.purchase_no}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {row.pharmacy_suppliers?.name ?? 'Supplier'} · {row.purchase_date ?? ''} · {row.status} · {row.payment_status}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{Number(row.total ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <Link href="/pharmacy/inventory" className="text-sm" style={{ color: 'var(--brand-orange)' }}>
        ← Inventory
      </Link>
    </div>
  )
}
