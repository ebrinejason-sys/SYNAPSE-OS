'use client'

import { useState, useCallback } from 'react'
import type { SelectedPatient } from '../../hooks/usePatientContext'

interface PatientSearchProps {
  onSelect: (patient: SelectedPatient) => void
}

interface RawPatient {
  id: string
  full_name: string
  mrn: string | null
}

export function PatientSearch({ onSelect }: PatientSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RawPatient[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}&limit=10`, {
        credentials: 'include',
      })
      const data = await res.json()
      setResults(
        (data.patients ?? []).map((p: { id: string; fullName: string; mrn: string | null }) => ({
          id: p.id,
          full_name: p.fullName,
          mrn: p.mrn,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search by name or MRN"
        className="rounded border border-edge bg-transparent px-3 py-2 text-sm text-primary-color"
      />
      {loading && <p className="text-xs opacity-60">Searching…</p>}
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--border-subtle)] rounded border border-edge">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect({ id: p.id, fullName: p.full_name, mrn: p.mrn })}
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface"
              >
                {p.full_name} {p.mrn ? `(${p.mrn})` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
