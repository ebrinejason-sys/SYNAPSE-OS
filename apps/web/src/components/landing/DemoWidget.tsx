'use client'
import { useState } from 'react'

const CHIPS = [
  'Fever', 'Headache', 'Cough', 'Chest Pain',
  'Diarrhoea', 'Vomiting', 'Fatigue', 'Shortness of Breath',
  'Abdominal Pain', 'Sore Throat', 'Rash', 'Joint Pain',
  'Neck Stiffness', 'Blurred Vision', 'Back Pain', 'Dizziness',
]

const DURATIONS = [
  { label: '< 24h',    val: '<24h' },
  { label: '1–3 days', val: '1-3d' },
  { label: '3–7 days', val: '3-7d' },
  { label: '> 1 week', val: '>1w'  },
]

const SEVERITIES = [
  { label: 'Mild',     val: 'mild',     color: '#22C55E' },
  { label: 'Moderate', val: 'moderate', color: '#EAB308' },
  { label: 'Severe',   val: 'severe',   color: '#EF4444' },
]

export function DemoWidget() {
  const [symptoms, setSymptoms] = useState('')
  const [chips, setChips]       = useState<string[]>([])
  const [duration, setDuration] = useState('')
  const [severity, setSeverity] = useState('')

  function toggleChip(c: string) {
    setChips(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function handleDiagnose() {
    const p = new URLSearchParams()
    const allSymptoms = [symptoms.trim(), ...chips].filter(Boolean).join(', ')
    if (allSymptoms) p.set('symptoms', allSymptoms)
    if (duration)    p.set('duration', duration)
    if (severity)    p.set('severity', severity)
    window.open(`https://demo.synapseos.tech${p.toString() ? '?' + p.toString() : ''}`, '_blank')
  }

  const hasInput = symptoms.trim().length > 0 || chips.length > 0

  return (
    <div
      className="max-w-2xl mx-auto rounded-2xl overflow-hidden"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-edge)', background: 'var(--bg-elevated)' }}
      >
        <div>
          <p className="font-display font-bold text-base">Try the AI Diagnosis Engine</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Enter symptoms below — no sign-up required
          </p>
        </div>
        <div
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(249,115,22,0.1)',
            color: 'var(--brand-orange)',
            border: '1px solid var(--border-orange)',
          }}
        >
          <span
            style={{
              width: '0.4rem', height: '0.4rem', borderRadius: '50%',
              background: 'var(--brand-orange)',
              animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
              display: 'inline-block',
            }}
          />
          Gemini AI
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Free-text input */}
        <textarea
          value={symptoms}
          onChange={e => setSymptoms(e.target.value)}
          placeholder={`Describe symptoms in your own words…\ne.g. "Fever for 2 days, severe headache, and neck stiffness"`}
          rows={3}
          className="w-full p-4 rounded-xl text-sm resize-none transition-all"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-edge)',
            color: 'var(--text-primary)',
            outline: 'none',
            lineHeight: 1.6,
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
          onBlur={e  => (e.target.style.borderColor = 'var(--border-edge)')}
        />

        {/* Quick-pick chips */}
        <div>
          <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-muted)' }}>
            Quick add symptoms:
          </p>
          <div className="flex flex-wrap gap-2">
            {CHIPS.map(chip => {
              const on = chips.includes(chip)
              return (
                <button
                  key={chip}
                  onClick={() => toggleChip(chip)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: on ? 'var(--brand-orange)' : 'var(--bg-elevated)',
                    color:      on ? '#07070A'             : 'var(--text-secondary)',
                    border:     `1px solid ${on ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
                  }}
                >
                  {chip}
                </button>
              )
            })}
          </div>
        </div>

        {/* Duration + Severity row */}
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-muted)' }}>
              Duration:
            </p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map(d => {
                const on = duration === d.val
                return (
                  <button
                    key={d.val}
                    onClick={() => setDuration(on ? '' : d.val)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: on ? 'rgba(232,184,75,0.15)' : 'var(--bg-elevated)',
                      color:      on ? 'var(--brand-gold)'     : 'var(--text-secondary)',
                      border:     `1px solid ${on ? 'var(--border-gold)' : 'var(--border-edge)'}`,
                    }}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--text-muted)' }}>
              Severity:
            </p>
            <div className="flex gap-2">
              {SEVERITIES.map(s => {
                const on = severity === s.val
                return (
                  <button
                    key={s.val}
                    onClick={() => setSeverity(on ? '' : s.val)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1"
                    style={{
                      background: on ? `${s.color}20` : 'var(--bg-elevated)',
                      color:      on ? s.color         : 'var(--text-secondary)',
                      border:     `1px solid ${on ? s.color + '40' : 'var(--border-edge)'}`,
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleDiagnose}
          disabled={!hasInput}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-all"
          style={{
            background: hasInput
              ? 'linear-gradient(135deg, var(--brand-orange), #ea580c)'
              : 'var(--bg-elevated)',
            color:  hasInput ? '#07070A'          : 'var(--text-muted)',
            cursor: hasInput ? 'pointer'          : 'not-allowed',
            boxShadow: hasInput ? '0 4px 20px rgba(249,115,22,0.3)' : 'none',
          }}
        >
          {hasInput ? 'Get AI Diagnosis →' : 'Enter symptoms above to continue'}
        </button>

        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          This is a demonstration only. Not a substitute for professional medical advice.{' '}
          Always consult a qualified clinician for health decisions.
        </p>
      </div>
    </div>
  )
}
