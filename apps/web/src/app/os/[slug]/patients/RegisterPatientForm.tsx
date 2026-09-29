'use client'

import { useCallback, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type DuplicateCandidate = { id: string; mrn: string | null; full_name: string; dob: string | null; sex: string | null }

function extractErrorMessage(error: any): string {
  // Handle plain string errors
  if (typeof error === 'string') {
    return error
  }

  // Handle zod flatten() error object
  if (error && typeof error === 'object') {
    // Try formErrors first
    if (Array.isArray(error.formErrors) && error.formErrors.length > 0) {
      return error.formErrors[0]
    }

    // Try fieldErrors
    if (error.fieldErrors && typeof error.fieldErrors === 'object') {
      for (const fieldName in error.fieldErrors) {
        const messages = error.fieldErrors[fieldName]
        if (Array.isArray(messages) && messages.length > 0) {
          return messages[0]
        }
      }
    }
  }

  return 'Failed to register patient'
}

export function RegisterPatientForm() {
  const router = useRouter()
  const { slug } = useParams<{ slug: string }>()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [sex, setSex] = useState<'M' | 'F'>('F')
  const [dob, setDob] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<DuplicateCandidate[] | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const restoreFocus = useRef(false)

  const reset = useCallback(() => {
    setFullName('')
    setDob('')
    setPhone('')
    setCandidates(null)
    setOverrideReason('')
    setError(null)
    restoreFocus.current = true
    setOpen(false)
  }, [])

  const submit = useCallback(async (duplicateOverrideReason?: string) => {
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
          duplicate_override_reason: duplicateOverrideReason,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 409 && data.error === 'POSSIBLE_DUPLICATE' && Array.isArray(data.candidates)) {
          setCandidates(data.candidates)
          return
        }
        setError(data.error ? extractErrorMessage(data.error) : 'Failed to register patient')
        return
      }
      reset()
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }, [fullName, sex, dob, phone, router, reset])

  if (!open) {
    return (
      <button
        ref={(el) => {
          if (el && restoreFocus.current) {
            restoreFocus.current = false
            el.focus()
          }
        }}
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-[#F97316] px-4 py-2 text-sm font-medium text-black"
      >
        Register patient
      </button>
    )
  }

  return (
    <form
      aria-label="Register patient"
      onSubmit={(e) => {
        e.preventDefault()
        if (!submitting && candidates === null) submit()
      }}
      className="flex flex-col gap-2 rounded border border-[var(--synapse-border)] p-4"
    >
      <input
        autoFocus
        aria-label="Full name"
        aria-required="true"
        value={fullName}
        onChange={(e) => { setFullName(e.target.value); setCandidates(null) }}
        placeholder="Full name"
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      />
      <select
        aria-label="Sex"
        value={sex}
        onChange={(e) => { setSex(e.target.value as 'M' | 'F'); setCandidates(null) }}
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      >
        <option value="F">Female</option>
        <option value="M">Male</option>
      </select>
      <input
        type="date"
        aria-label="Date of birth"
        value={dob}
        onChange={(e) => { setDob(e.target.value); setCandidates(null) }}
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      />
      <input
        aria-label="Phone (optional)"
        value={phone}
        onChange={(e) => { setPhone(e.target.value); setCandidates(null) }}
        placeholder="Phone (optional)"
        className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
      />
      {error && <p role="alert" className="text-xs text-red-700 dark:text-red-400">{error}</p>}
      {candidates && (
        <div role="alert" className="flex flex-col gap-2 rounded border border-amber-500/60 p-3 text-sm">
          <p className="font-medium">This patient may already be registered.</p>
          <ul className="flex flex-col gap-1">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span>
                  {c.full_name} · {c.mrn ?? 'no MRN'} · {c.dob ? c.dob.slice(0, 10) : 'DOB unknown'} · {c.sex ?? ''}
                </span>
                <button
                  type="button"
                  onClick={() => router.push(`/os/${slug}/patients/${c.id}`)}
                  className="rounded border border-[var(--synapse-border)] px-3 py-1 text-xs"
                >
                  Use existing
                </button>
              </li>
            ))}
          </ul>
          <label className="flex flex-col gap-1 text-xs">
            Reason for creating a new record anyway
            <input
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. different person with the same name"
              className="rounded border border-[var(--synapse-border)] bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={submitting || overrideReason.trim().length < 5}
            onClick={() => submit(overrideReason.trim())}
            className="self-start rounded border border-amber-500 px-3 py-1 text-xs disabled:opacity-50"
          >
            Create anyway
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !fullName.trim() || candidates !== null}
          className="rounded bg-[#F97316] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={reset} className="rounded border border-[var(--synapse-border)] px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}
