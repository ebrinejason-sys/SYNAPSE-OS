'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SynapseLogo } from '../../../components/SynapseLogo'

export default function ApplyPharmacyPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    pharmacy_name: '',
    location: '',
    branches: '1',
    current_system: '',
    message: '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/applications/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          hospital_name: form.pharmacy_name,
          location: form.location,
          bed_count: form.branches,
          current_system: form.current_system,
          departments: ['Pharmacy', 'POS', 'Inventory'],
          message: `[PHARMACY APPLICATION]\nBranches: ${form.branches}\n${form.message}`,
          facility_type: 'pharmacy',
        }),
      })
      if (!res.ok) throw new Error('Submission failed')
      window.location.href = '/apply/thank-you'
    } catch {
      setError('Something went wrong. Please try again or visit our contact page.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-edge)',
    color: 'var(--text-primary)',
  }

  return (
    <main className="min-h-screen px-4 py-12" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-8 inline-block">
          <SynapseLogo size="md" />
        </Link>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#22C55E' }}>
          Pharmacy onboarding
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold">Apply to onboard your pharmacy</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          We review applications, provision your tenant, create a default store, and send admin login details.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {(['name', 'email', 'phone', 'pharmacy_name', 'location'] as const).map((field) => (
            <div key={field}>
              <label className="mb-1 block text-xs font-semibold capitalize" style={{ color: 'var(--text-muted)' }}>
                {field.replace('_', ' ')}
              </label>
              <input
                required={field !== 'phone'}
                type={field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={(e) => set(field, e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Branches
              </label>
              <input
                value={form.branches}
                onChange={(e) => set('branches', e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Current system
              </label>
              <input
                value={form.current_system}
                onChange={(e) => set('current_system', e.target.value)}
                placeholder="Paper / Excel / other"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Notes
            </label>
            <textarea
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={inputStyle}
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3.5 text-sm font-bold disabled:opacity-50"
            style={{ background: '#22C55E', color: '#07070A' }}
          >
            {loading ? 'Submitting…' : 'Submit pharmacy application'}
          </button>
        </form>
      </div>
    </main>
  )
}
