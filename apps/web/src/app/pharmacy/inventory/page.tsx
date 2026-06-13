'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Package, AlertTriangle } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface Drug {
  id: string
  generic_name: string
  brand_name: string | null
  formulation: string | null
  strength: string | null
  quantity_in_stock: number | null
  reorder_level: number | null
  unit_price_ugx: number | null
  expiry_date: string | null
  category: string | null
}

export default function PharmacyInventoryPage() {
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const meRes = await fetch('/api/auth/me')
      const { user } = meRes.ok ? await meRes.json() : { user: null }
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data: profile } = await sb.from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
      if (!profile?.hospital_id) { setLoading(false); return }
      const { data } = await sb
        .from('drug_inventory')
        .select('id, generic_name, brand_name, formulation, strength, quantity_in_stock, reorder_level, unit_price_ugx, expiry_date, category')
        .eq('hospital_id', profile.hospital_id)
        .order('generic_name') as { data: Drug[] | null }
      setDrugs(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = drugs.filter(d =>
    d.generic_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.brand_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const lowStock = drugs.filter(d => (d.quantity_in_stock ?? 0) <= (d.reorder_level ?? 10))
  const fmt = (n: number | null) =>
    n ? new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n) : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Drug Inventory</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {drugs.length} drugs · {lowStock.length} low stock
          </p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>Low Stock</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {lowStock.map(d => d.generic_name).join(', ')}
            </p>
          </div>
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search drugs…"
        className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
      />

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading inventory…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No drugs found.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-edge)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
                {['Drug', 'Form/Strength', 'Stock', 'Price', 'Expiry'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const isLow = (d.quantity_in_stock ?? 0) <= (d.reorder_level ?? 10)
                return (
                  <tr key={d.id} style={{ background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{d.generic_name}</p>
                      {d.brand_name && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.brand_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {[d.formulation, d.strength].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: isLow ? '#EF4444' : 'var(--text-primary)' }}>
                      {d.quantity_in_stock ?? 0} {isLow && '⚠'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmt(d.unit_price_ugx)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {d.expiry_date ? new Date(d.expiry_date).toLocaleDateString('en-UG') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
