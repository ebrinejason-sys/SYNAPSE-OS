'use client'
import { useEffect, useState } from 'react'
import { Building2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface Dept {
  id: string
  name: string
  code: string | null
  created_at: string
}

export const dynamic = 'force-dynamic'

export default function AdminDepartmentsPage() {
  const [depts, setDepts] = useState<Dept[]>([])
  const [loading, setLoading] = useState(true)
  const [hospitalId, setHospitalId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const meRes = await fetch('/api/auth/me')
      const { user } = meRes.ok ? await meRes.json() : { user: null }
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any).from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
      if (!profile?.hospital_id) { setLoading(false); return }
      setHospitalId(profile.hospital_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('departments')
        .select('id, name, code, created_at')
        .eq('hospital_id', profile.hospital_id)
        .order('name') as { data: Dept[] | null }
      setDepts(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleAdd() {
    if (!newName.trim() || !hospitalId) return
    setSaving(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('departments')
      .insert({ name: newName.trim(), code: newCode.trim() || null, hospital_id: hospitalId })
      .select('id, name, code, created_at')
      .single() as { data: Dept | null; error: unknown }
    if (!error && data) {
      setDepts(prev => [...prev, data as Dept].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewCode('')
      setAdding(false)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this department?')) return
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('departments').delete().eq('id', id)
    setDepts(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Departments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{depts.length} departments configured</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(a => !a)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" /> Add Department
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-orange)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New Department</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Department Name *</label>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Cardiology"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Code (optional)</label>
              <input
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                placeholder="e.g. CARD"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn-secondary text-sm">Cancel</button>
            <button type="button" onClick={handleAdd} disabled={!newName.trim() || saving} className="btn-primary text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Department'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>Loading departments…</div>
      ) : depts.length === 0 ? (
        <div className="py-16 text-center">
          <Building2 className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No departments yet. Add your hospital departments to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {depts.map(dept => (
            <div
              key={dept.id}
              className="group flex items-center justify-between rounded-xl p-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}
                >
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{dept.name}</p>
                  {dept.code && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{dept.code}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(dept.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: '#EF4444' }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
