'use client'

import { useCallback, useEffect, useState } from 'react'

type Pathway = {
  id: string
  name: string
  version: string
  source: { name: string; organization: string; version: string }
  triggers: string[]
}

type Suggestion = {
  pathwayId: string
  pathwayName: string
  version: string
  source: string
  why: string
  keyTrigger: string
}

type CarePlan = {
  id: string
  pathwayId: string
  pathwayVersion: string
  status: string
  currentStepId: string
  steps: Array<{ stepId: string; status: string; recommendedAction: string; actualAction?: string | null }>
}

export function ClinicalPathwaysPanel({
  encounterId,
  patientId,
  presentingComplaint,
}: {
  encounterId?: string | null
  patientId?: string | null
  presentingComplaint?: string
}) {
  const [pathways, setPathways] = useState<Pathway[]>([])
  const [suggested, setSuggested] = useState<Suggestion[]>([])
  const [plans, setPlans] = useState<CarePlan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [overrideReason, setOverrideReason] = useState('')

  const load = useCallback(async () => {
    const catalog = await fetch(`/api/clinical/pathways?country_pack=UG&presenting=${encodeURIComponent(presentingComplaint ?? '')}`, { credentials: 'include' })
    if (!catalog.ok) {
      setError('Sign in as clinical staff to view pathways.')
      return
    }
    const json = await catalog.json()
    setPathways(json.pathways ?? [])
    setSuggested(json.suggested ?? [])
    if (encounterId) {
      const plansRes = await fetch(`/api/clinical/pathways/care-plans?encounter_id=${encounterId}`, { credentials: 'include' })
      if (plansRes.ok) {
        const data = await plansRes.json()
        setPlans(data.carePlans ?? [])
      }
    }
    setError(null)
  }, [encounterId, presentingComplaint])

  useEffect(() => {
    load().catch(() => setError('Unable to load pathways'))
  }, [load])

  async function activate(pathwayId: string) {
    if (!encounterId || !patientId) {
      setError('Open an encounter before activating a pathway.')
      return
    }
    setBusy(pathwayId)
    try {
      const res = await fetch('/api/clinical/pathways/care-plans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, encounter_id: encounterId, pathway_id: pathwayId, actor_kind: 'clinician' }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Activation failed')
        return
      }
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function act(planId: string, action: 'complete_step' | 'override' | 'abandon' | 'complete_plan') {
    setBusy(planId)
    try {
      const res = await fetch(`/api/clinical/pathways/care-plans/${planId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action,
          actor_kind: 'clinician',
          reason: action === 'override' || action === 'abandon' ? overrideReason : undefined,
          actual_action: action === 'override' ? 'Clinician modified recommended action' : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Update failed')
        return
      }
      setOverrideReason('')
      await load()
    } finally {
      setBusy(null)
    }
  }

  const groups = {
    Suggested: suggested,
    Active: plans.filter((plan) => plan.status === 'active'),
    Completed: plans.filter((plan) => plan.status === 'completed'),
    Overridden: plans.filter((plan) => plan.status === 'overridden' || plan.steps.some((step) => step.status === 'overridden')),
  }

  return (
    <section className="clinical-card mt-6 p-4" aria-labelledby="pathways-heading">
      <h2 id="pathways-heading" className="font-display text-lg text-primary-color">Clinical pathways</h2>
      <p className="mt-1 text-xs text-muted-color">Suggestions are not orders. A clinician must activate a pathway and confirm any investigation.</p>
      {error ? <p className="mt-3 text-sm text-amber-300">{error}</p> : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Suggested</h3>
          {groups.Suggested.length === 0 ? <p className="mt-2 text-xs text-muted-color">No matching suggestion.</p> : null}
          <ul className="mt-2 space-y-2">
            {groups.Suggested.map((item) => (
              <li key={item.pathwayId} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{item.pathwayName}</p>
                <p className="text-xs text-muted-color">Why: {item.why}</p>
                <p className="text-xs text-muted-color">Source: {item.source} · v{item.version}</p>
                <p className="text-xs text-muted-color">Key trigger: {item.keyTrigger}</p>
                <button type="button" className="mt-2 rounded border border-orange-500/40 px-2 py-1 text-xs" disabled={busy === item.pathwayId} onClick={() => activate(item.pathwayId)}>
                  Open / activate
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium">Catalog</h3>
          <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs">
            {pathways.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span>{item.name} · v{item.version}</span>
                <button type="button" className="rounded border border-border px-2 py-0.5" disabled={busy === item.id} onClick={() => activate(item.id)}>Activate</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(['Active', 'Completed', 'Overridden'] as const).map((label) => (
        <div key={label} className="mt-4">
          <h3 className="text-sm font-medium">{label}</h3>
          {groups[label].length === 0 ? <p className="mt-2 text-xs text-muted-color">None.</p> : null}
          <ul className="mt-2 space-y-2">
            {groups[label].map((plan) => (
              <li key={plan.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{plan.pathwayId} · v{plan.pathwayVersion}</p>
                <p className="text-xs text-muted-color">Status {plan.status} · current {plan.currentStepId}</p>
                {plan.status === 'active' ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="rounded border border-emerald-500/40 px-2 py-1 text-xs" onClick={() => act(plan.id, 'complete_step')}>Complete step</button>
                    <input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Override reason" className="rounded border border-border bg-transparent px-2 py-1 text-xs" />
                    <button type="button" className="rounded border border-amber-500/40 px-2 py-1 text-xs" onClick={() => act(plan.id, 'override')}>Override</button>
                    <button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={() => act(plan.id, 'abandon')}>Abandon</button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
