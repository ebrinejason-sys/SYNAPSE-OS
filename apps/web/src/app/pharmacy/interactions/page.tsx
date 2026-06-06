'use client'

import { useState } from 'react'
import { Zap, Plus, Trash2, Bot } from 'lucide-react'

interface Drug {
  name: string
}

interface Interaction {
  severity: 'major' | 'moderate' | 'minor'
  drugs: string[]
  description: string
  recommendation: string
}

interface CheckResult {
  interactions: Interaction[]
  safe: boolean
  summary: string
}

const SEVERITY_STYLE: Record<string, { background: string; color: string }> = {
  major:    { background: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
  moderate: { background: 'rgba(234,179,8,0.1)',   color: '#EAB308' },
  minor:    { background: 'rgba(34,197,94,0.1)',   color: '#22C55E' },
}

export default function PharmacyInteractionsPage() {
  const [drugs, setDrugs] = useState<Drug[]>([{ name: '' }, { name: '' }])
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)

  function updateDrug(i: number, name: string) {
    setDrugs(prev => prev.map((d, idx) => idx === i ? { name } : d))
  }

  function addDrug() {
    setDrugs(prev => [...prev, { name: '' }])
  }

  function removeDrug(i: number) {
    setDrugs(prev => prev.filter((_, idx) => idx !== i))
  }

  async function check() {
    const names = drugs.map(d => d.name.trim()).filter(Boolean)
    if (names.length < 2) return
    setChecking(true)
    setResult(null)
    try {
      const res = await fetch('/api/pharmacy/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs: names }),
      })
      const data = await res.json() as CheckResult
      setResult(data)
    } catch {
      setResult({ interactions: [], safe: true, summary: 'Unable to check interactions. Please try again.' })
    }
    setChecking(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Drug Interaction Checker</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>AI-powered interaction checking using Gemini — enter 2+ drugs</p>
      </div>

      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Enter Drugs</p>
        <div className="space-y-2">
          {drugs.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={d.name}
                onChange={e => updateDrug(i, e.target.value)}
                placeholder={`Drug ${i + 1} (e.g. Metformin)`}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
              />
              {drugs.length > 2 && (
                <button type="button" onClick={() => removeDrug(i)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={addDrug}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}>
            <Plus className="h-4 w-4" /> Add Drug
          </button>
          <button type="button" onClick={check}
            disabled={checking || drugs.filter(d => d.name.trim()).length < 2}
            className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-40 transition-all"
            style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
            <Bot className="h-4 w-4" />
            {checking ? 'Checking…' : 'Check Interactions'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div
            className="flex items-start gap-3 rounded-2xl p-4"
            style={{
              background: result.safe ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${result.safe ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}
          >
            <Zap className="h-5 w-5 shrink-0 mt-0.5" style={{ color: result.safe ? '#22C55E' : '#EF4444' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: result.safe ? '#22C55E' : '#EF4444' }}>
                {result.safe ? 'No Significant Interactions Found' : 'Interactions Detected'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{result.summary}</p>
            </div>
          </div>

          {result.interactions.map((interaction, i) => (
            <div key={i} className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full px-2 py-0.5 text-xs font-bold capitalize"
                  style={SEVERITY_STYLE[interaction.severity] ?? SEVERITY_STYLE.minor}>
                  {interaction.severity}
                </span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {interaction.drugs.join(' + ')}
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{interaction.description}</p>
              <div className="flex items-start gap-2 rounded-xl px-3 py-2"
                style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--brand-orange)' }}>Recommendation:</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{interaction.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
