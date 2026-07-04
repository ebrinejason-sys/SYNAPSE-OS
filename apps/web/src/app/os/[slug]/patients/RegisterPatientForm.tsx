'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function RegisterPatientForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [sex, setSex] = useState<'M' | 'F'>('F')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (!fullName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/patients/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          sex,
          dob: dob || undefined,
          phone: phone || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ? JSON.stringify(data.error) : 'Failed to register patient')
        return
      }
      setFullName('')
      setDob('')
      setPhone('')
      setOpen(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }, [fullName, sex, dob, phone, router])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-[#F97316] px-4 py-2 text-sm font-medium text-black"
      >
        Register patient
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-[var(--synapse-border)] p-4">
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Full name"
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      />
      <select
        value={sex}
        onChange={(e) => setSex(e.target.value as 'M' | 'F')}
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      >
        <option value="F">Female</option>
        <option value="M">Male</option>
      </select>
      <input
        type="date"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (optional)"
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting || !fullName.trim()}
          onClick={submit}
          className="rounded bg-[#F97316] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-[var(--synapse-border)] px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}
