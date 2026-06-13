'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, AlertTriangle } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface InventoryItem {
  id: string
  name: string
  category: string | null
  quantity: number | null
  reorder_level: number | null
  unit: string | null
  expiry_date: string | null
}

export default function AdminSupplyPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

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
      const { data } = await sb.from('inventory_items')
        .select('id, name, category, quantity, reorder_level, unit, expiry_date')
        .eq('hospital_id', profile.hospital_id)
        .order('name') as { data: InventoryItem[] | null }
      setItems(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const lowStock = items.filter(i => (i.quantity ?? 0) <= (i.reorder_level ?? 10))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Supply Chain</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {items.length} items · {lowStock.length} low stock
          </p>
        </div>
        <Link href="/admin/supply/orders"
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
          + New Order
        </Link>
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>Low Stock Alert</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {lowStock.map(i => i.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading inventory…</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No inventory items yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-edge)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-edge)' }}>
                {['Item', 'Category', 'Qty', 'Unit', 'Reorder At', 'Expiry'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const isLow = (item.quantity ?? 0) <= (item.reorder_level ?? 10)
                return (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{item.category ?? '—'}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: isLow ? '#EF4444' : 'var(--text-primary)' }}>
                      {item.quantity ?? 0} {isLow && <span className="text-xs">⚠</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{item.unit ?? '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{item.reorder_level ?? '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-UG') : '—'}
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
