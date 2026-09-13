'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { ClinicalWriteup } from '@synapse/db/clinical-writeup'
import {
  flushHospitalClinicalOutbox,
  isBrowserOffline,
  pendingHospitalClinicalSummary,
  queueWriteupOffline,
  type HospitalClinicalSyncContext,
} from '@/lib/clinical-offline/hospital-clinical-sync'

type Completeness = { filled: number; total: number; missing: string[] }

type WriteupResponse = {
  encounterId: string
  patientId: string
  isSigned: boolean
  chiefComplaint: string | null
  clinicalNote: string
  writeup: ClinicalWriteup
  completeness: Completeness
  syncContext?: HospitalClinicalSyncContext
  error?: string
}

const SECTIONS: Array<{ key: keyof ClinicalWriteup; label: string; hint: string; rows?: number }> = [
  { key: 'hpi', label: 'History of present illness', hint: 'Onset, duration, character, associated symptoms', rows: 5 },
  { key: 'pmh', label: 'Past medical / surgical history', hint: 'Chronic conditions, surgeries, hospitalizations', rows: 3 },
  { key: 'medications', label: 'Current medications', hint: 'Dose, route, frequency', rows: 3 },
  { key: 'allergies', label: 'Allergies / adverse reactions', hint: 'Drug, food, environmental — reaction type', rows: 2 },
  { key: 'familySocial', label: 'Family / social history', hint: 'Relevant family illness, occupation, substance use', rows: 3 },
  { key: 'ros', label: 'Review of systems', hint: 'Pertinent positives and negatives', rows: 4 },
  { key: 'examination', label: 'Examination', hint: 'General + focused systems findings', rows: 5 },
  { key: 'assessment', label: 'Assessment', hint: 'Working diagnoses / differentials', rows: 4 },
  { key: 'plan', label: 'Plan', hint: 'Investigations, treatment, disposition intent', rows: 4 },
]

export function ClinicalWriteupPanel({
  encounterId,
  backHref,
}: {
  encounterId: string
  backHref?: string
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [queueNotice, setQueueNotice] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [payload, setPayload] = useState<WriteupResponse | null>(null)
  const [draft, setDraft] = useState<ClinicalWriteup | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/opd/encounters/${encounterId}/write-up`)
      const body = (await res.json()) as WriteupResponse
      if (!res.ok) throw new Error(body.error || `Failed to load (${res.status})`)
      setPayload(body)
      setDraft(body.writeup)
      if (body.syncContext) {
        refreshPending(body.syncContext)
        if (!isBrowserOffline()) {
          void flushHospitalClinicalOutbox(body.syncContext).then(() => {
            refreshPending(body.syncContext!)
          })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load write-up')
    } finally {
      setLoading(false)
    }
  }, [encounterId])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(() => {
    if (!payload || !draft) return false
    return SECTIONS.some(({ key }) => (draft[key] ?? '') !== (payload.writeup[key] ?? ''))
  }, [draft, payload])

  function refreshPending(ctx: HospitalClinicalSyncContext | undefined) {
    if (!ctx) {
      setPendingCount(0)
      return
    }
    const summary = pendingHospitalClinicalSummary(ctx)
    setPendingCount(summary.pending + summary.conflicts + summary.rejected)
  }

  async function flushPending(ctx: HospitalClinicalSyncContext) {
    const summary = await flushHospitalClinicalOutbox(ctx)
    refreshPending(ctx)
    if (summary.acknowledged > 0) {
      setQueueNotice(`Synced ${summary.acknowledged} queued change(s) to server`)
      await load()
    } else if (summary.conflicts > 0 || summary.rejected > 0) {
      setQueueNotice('Some queued changes need review (conflict or rejected)')
    }
  }

  async function save() {
    if (!draft || payload?.isSigned) return
    setSaving(true)
    setError(null)
    setQueueNotice(null)
    const syncContext = payload?.syncContext

    const tryOnline = async () => {
      const res = await fetch(`/api/opd/encounters/${encounterId}/write-up`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const body = (await res.json()) as WriteupResponse & { clinicalNote?: string }
      if (!res.ok) throw new Error((body as { error?: string }).error || `Save failed (${res.status})`)
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              writeup: body.writeup,
              clinicalNote: body.clinicalNote ?? prev.clinicalNote,
              completeness: body.completeness,
              syncContext: body.syncContext ?? prev.syncContext,
            }
          : prev,
      )
      setDraft(body.writeup)
      setSavedAt(new Date().toLocaleTimeString())
    }

    try {
      if (isBrowserOffline()) {
        if (!syncContext) throw new Error('Offline queue unavailable (missing sync context)')
        const queued = await queueWriteupOffline(syncContext, {
          encounterId,
          writeup: draft,
        })
        if (!queued.ok) throw new Error(queued.error)
        refreshPending(syncContext)
        setQueueNotice('Queued offline — not server-saved until reconnect')
        return
      }

      try {
        await tryOnline()
        if (syncContext) {
          await flushPending(syncContext)
        }
      } catch (onlineError) {
        // Network/server failure while appearing online: durable local queue, never claim saved.
        if (!syncContext) throw onlineError
        const queued = await queueWriteupOffline(syncContext, {
          encounterId,
          writeup: draft,
        })
        if (!queued.ok) throw onlineError
        refreshPending(syncContext)
        setQueueNotice('Save failed online; queued locally — not server-saved yet')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-color">Loading clinical write-up…</p>
  }

  if (!draft || !payload) {
    return (
      <div className="clinical-card p-6">
        <p className="text-sm text-red-500">{error ?? 'Write-up unavailable'}</p>
        <button type="button" className="mt-3 text-sm underline" onClick={() => void load()}>
          Retry
        </button>
      </div>
    )
  }

  const pct = Math.round((payload.completeness.filled / payload.completeness.total) * 100)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {backHref ? (
            <Link href={backHref} className="text-sm text-muted-color hover:text-primary-color">
              ← Encounter
            </Link>
          ) : null}
          <h1 className="mt-1 font-display text-2xl text-primary-color">Clinical write-up</h1>
          <p className="mt-1 text-sm text-secondary-color">
            Chief complaint: {payload.chiefComplaint?.trim() || '—'}
            {payload.isSigned ? ' · Signed (read-only)' : ''}
          </p>
        </div>
        <div className="clinical-card px-4 py-3 text-sm">
          <div className="font-medium text-primary-color">{pct}% complete</div>
          <div className="text-muted-color">
            {payload.completeness.filled}/{payload.completeness.total} sections
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        {SECTIONS.map((section) => (
          <label key={section.key} className="clinical-card block p-4">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-primary-color">{section.label}</span>
              {!String(draft[section.key] ?? '').trim() ? (
                <span className="text-xs text-muted-color">Empty</span>
              ) : (
                <span className="text-xs text-emerald-600">Filled</span>
              )}
            </div>
            <p className="mb-2 text-xs text-muted-color">{section.hint}</p>
            <textarea
              className="w-full rounded-xl border border-subtle bg-base px-3 py-2 text-sm text-primary-color outline-none focus:border-strong"
              rows={section.rows ?? 3}
              disabled={payload.isSigned || saving}
              value={String(draft[section.key] ?? '')}
              onChange={(e) => setDraft({ ...draft, [section.key]: e.target.value })}
            />
          </label>
        ))}
      </div>

      <div className="clinical-card p-4">
        <h2 className="text-sm font-medium text-primary-color">Assembled note preview</h2>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-elevated p-3 text-xs text-secondary-color">
          {payload.clinicalNote || 'Save to generate the signed-ready narrative.'}
        </pre>
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border border-subtle bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
        <button
          type="button"
          disabled={payload.isSigned || saving || !dirty}
          onClick={() => void save()}
          className="rounded-xl bg-[var(--brand-orange)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Saving…' : dirty ? 'Save write-up' : 'Saved'}
        </button>
        <Link
          href={`/encounter/${encounterId}/sign`}
          className="rounded-xl border border-subtle px-4 py-2 text-sm text-primary-color"
        >
          Continue to sign
        </Link>
        <Link
          href={`/encounter/${encounterId}/orders`}
          className="rounded-xl border border-subtle px-4 py-2 text-sm text-primary-color"
        >
          Orders
        </Link>
        {savedAt ? <span className="text-xs text-muted-color">Last server-saved {savedAt}</span> : null}
        {queueNotice ? <span className="text-xs text-amber-700 dark:text-amber-300">{queueNotice}</span> : null}
        {pendingCount > 0 ? (
          <span className="text-xs text-amber-700 dark:text-amber-300">{pendingCount} pending offline</span>
        ) : null}
      </div>
    </div>
  )
}
