'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react'

const CHIPS = [
  'Fever', 'Headache', 'Cough', 'Chest Pain',
  'Diarrhoea', 'Vomiting', 'Fatigue', 'Shortness of Breath',
  'Abdominal Pain', 'Sore Throat', 'Rash', 'Neck Stiffness',
]

type Differential = {
  condition: string
  confidence: 'high' | 'medium' | 'low'
  rationale: string
}

type DemoResult = {
  differentials: Differential[]
  red_flags: string[]
  suggested_workup: string[]
  clinical_note: string
  follow_up_questions?: string[]
}

const CONF_COLOR = {
  high: '#22C55E',
  medium: '#EAB308',
  low: '#A0A0B0',
}

export function DemoWidget() {
  const [symptoms, setSymptoms] = useState('')
  const [chips, setChips] = useState<string[]>([])
  const [age, setAge] = useState('')
  const [sex, setSex] = useState('unknown')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DemoResult | null>(null)
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({})
  const [round, setRound] = useState(0)

  function toggleChip(c: string) {
    setChips((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const allSymptoms = [symptoms.trim(), ...chips].filter(Boolean).join(', ')
  const hasInput = allSymptoms.length > 0

  async function runDiagnosis(extraContext?: string) {
    if (!hasInput) return
    setLoading(true)
    setError('')
    try {
      const complaint = extraContext
        ? `${allSymptoms}. Additional context: ${extraContext}`
        : allSymptoms

      const res = await fetch('/api/demo/differential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chiefComplaint: complaint,
          age: age ? Number(age) : undefined,
          sex,
          vitals: undefined,
          requestFollowUp: round === 0,
        }),
      })
      const data = await res.json() as DemoResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Demo unavailable')
      setResult(data)
      if (round === 0 && data.follow_up_questions?.length) {
        setRound(1)
      } else {
        setRound(2)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run demo')
    } finally {
      setLoading(false)
    }
  }

  function refineWithAnswers() {
    const answers = Object.entries(followUpAnswers)
      .filter(([, v]) => v.trim())
      .map(([q, a]) => `${q}: ${a}`)
      .join('; ')
    void runDiagnosis(answers)
  }

  return (
    <div
      className="mx-auto max-w-3xl overflow-hidden rounded-2xl"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
    >
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-edge)', background: 'var(--bg-elevated)' }}
      >
        <div>
          <p className="font-display text-base font-bold">AI clinical decision support</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Uganda Clinical Guidelines · East Africa endemic disease priors
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: 'rgba(31,166,166,0.12)', color: 'var(--brand-teal)', border: '1px solid rgba(31,166,166,0.3)' }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Live demo
        </div>
      </div>

      <div className="space-y-5 p-6">
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder='Chief complaint, e.g. "Fever 3 days, headache, neck stiffness"'
          rows={2}
          className="w-full resize-none rounded-xl p-4 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
        />

        <div className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => {
            const on = chips.includes(chip)
            return (
              <button
                key={chip}
                type="button"
                onClick={() => toggleChip(chip)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: on ? 'var(--brand-orange)' : 'var(--bg-elevated)',
                  color: on ? '#07070A' : 'var(--text-secondary)',
                  border: `1px solid ${on ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
                }}
              >
                {chip}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <input
            type="number"
            min={0}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Age"
            className="rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
          />
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
          >
            <option value="unknown">Sex</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <button
            type="button"
            onClick={() => void runDiagnosis()}
            disabled={!hasInput || loading}
            className="rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, var(--brand-orange), #ea580c)', color: '#07070A' }}
          >
            {loading ? 'Analysing…' : 'Analyse'}
          </button>
        </div>

        {result?.follow_up_questions && round === 1 ? (
          <div className="space-y-3 rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-gold)' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--brand-gold)' }}>
              Precision questions to sharpen the differential
            </p>
            {result.follow_up_questions.map((q) => (
              <div key={q}>
                <p className="mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{q}</p>
                <input
                  value={followUpAnswers[q] ?? ''}
                  onChange={(e) => setFollowUpAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={refineWithAnswers}
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold"
              style={{ background: 'var(--brand-teal)', color: '#07070A' }}
            >
              Refine diagnosis with answers
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {result && round >= 1 ? (
          <div className="space-y-4">
            {result.clinical_note ? (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{result.clinical_note}</p>
            ) : null}
            <div className="space-y-2">
              {result.differentials?.slice(0, 5).map((d) => (
                <div
                  key={d.condition}
                  className="flex items-start justify-between gap-3 rounded-lg px-3 py-2.5"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                >
                  <div>
                    <p className="text-sm font-semibold">{d.condition}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.rationale}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase" style={{ color: CONF_COLOR[d.confidence] }}>
                    {d.confidence}
                  </span>
                </div>
              ))}
            </div>
            {result.red_flags?.length ? (
              <div className="flex gap-2 rounded-lg p-3 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span style={{ color: 'var(--text-secondary)' }}>{result.red_flags.join(' · ')}</span>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="https://demo.synapseos.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold"
                style={{ color: 'var(--brand-orange)' }}
              >
                Full demo workspace <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/signup/patient" className="text-sm font-semibold" style={{ color: 'var(--brand-teal)' }}>
                Create account to save results →
              </Link>
            </div>
          </div>
        ) : null}

        <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Decision support only, not a diagnosis. A qualified clinician must confirm all clinical decisions.
        </p>
      </div>
    </div>
  )
}
