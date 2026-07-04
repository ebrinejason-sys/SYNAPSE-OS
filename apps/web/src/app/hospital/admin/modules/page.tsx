'use client'

import { useEffect, useState } from 'react'

interface ModuleRow {
  key: string
  label: string
  feature_key: string | null
  is_active: boolean
}

function errorText(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.message === 'string') return d.message
    if (typeof d.error === 'string') return d.error
  }
  return fallback
}

export default function HospitalAdminModulesPage() {
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/hospital/admin/modules')
    const data = await res.json()
    if (!res.ok) setError(errorText(data, 'Failed to load'))
    else setModules(data.modules ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggle(moduleKey: string, isActive: boolean) {
    setError('')
    const res = await fetch('/api/hospital/admin/modules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_key: moduleKey, is_active: isActive }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(errorText(data, 'Toggle failed'))
      return
    }
    setModules((prev) => prev.map((m) => (m.key === moduleKey ? { ...m, is_active: data.module.is_active } : m)))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Module manager</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Enable hospital modules. Subscription features return 402; inactive modules return 403.
        </p>
      </div>
      {error && <div className="rounded-xl px-4 py-3 text-sm text-red-500" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</div>}
      {loading ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p> : (
        <div className="space-y-2">
          {modules.map((mod) => (
            <div key={mod.key} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <div>
                <p className="text-sm font-medium">{mod.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{mod.key}{mod.feature_key ? ` · ${mod.feature_key}` : ''}</p>
              </div>
              <button type="button" disabled={mod.key === 'core'} onClick={() => toggle(mod.key, !mod.is_active)}
                className="rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-40"
                style={{ background: mod.is_active ? 'var(--brand-orange)' : 'var(--bg-elevated)', color: mod.is_active ? '#07070A' : 'var(--text-secondary)' }}>
                {mod.is_active ? 'On' : 'Off'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
