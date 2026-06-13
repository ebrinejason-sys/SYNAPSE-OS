'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bot, Copy, CheckCheck } from 'lucide-react'
import { createClient } from '../../../../lib/supabase/client'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

interface Claim {
  id: string
  claim_number: string | null
  insurer_name: string | null
  billed_amount: number | null
  denial_reason: string | null
  primary_icd11: string | null
}

export default function AdminAppealsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <AdminAppealsInner />
    </Suspense>
  )
}

function AdminAppealsInner() {
  const searchParams = useSearchParams()
  const preselectedClaimId = searchParams.get('claimId')

  const [claims, setClaims] = useState<Claim[]>([])
  const [selectedId, setSelectedId] = useState(preselectedClaimId ?? '')
  const [customReason, setCustomReason] = useState('')
  const [generating, setGenerating] = useState(false)
  const [letter, setLetter] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const user = await getCurrentUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data: profile } = await sb.from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
      if (!profile?.hospital_id) return
      const { data } = await sb
        .from('insurance_claims')
        .select('id, claim_number, insurer_name, billed_amount, denial_reason, primary_icd11')
        .eq('hospital_id', profile.hospital_id)
        .in('status', ['denied', 'appealed'])
        .order('submitted_at', { ascending: false })
        .limit(50) as { data: Claim[] | null }
      setClaims(data ?? [])
    }
    load()
  }, [])

  const selected = claims.find(c => c.id === selectedId)

  async function generate() {
    if (!selected) return
    setGenerating(true)
    setLetter('')
    try {
      const res = await fetch('/api/insurance/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: selected.id,
          claimNumber: selected.claim_number,
          insurerName: selected.insurer_name,
          billedAmount: selected.billed_amount,
          denialReason: customReason || selected.denial_reason,
          icd11: selected.primary_icd11,
        }),
      })
      const data = await res.json() as { letter?: string }
      setLetter(data.letter ?? '')
    } catch {
      setLetter('Failed to generate appeal. Please try again.')
    }
    setGenerating(false)
  }

  async function copy() {
    await navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fmt = (n: number | null) =>
    n ? new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n) : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/insurance" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> Insurance
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>AI Appeal Generator</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Generate professional appeal letters for denied claims using Gemini AI
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Select Denied Claim</label>
            {claims.length === 0 ? (
              <div className="rounded-xl py-8 text-center text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-muted)' }}>
                No denied claims found.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {claims.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="w-full flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-all"
                    style={{
                      background: selectedId === c.id ? 'rgba(249,115,22,0.08)' : 'var(--bg-surface)',
                      border: `1px solid ${selectedId === c.id ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {c.claim_number ?? c.id.slice(0, 8)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {c.insurer_name ?? 'Unknown insurer'} · {fmt(c.billed_amount)}
                      </p>
                      {c.denial_reason && (
                        <p className="text-xs mt-1 truncate" style={{ color: '#EF4444' }}>
                          Denied: {c.denial_reason}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Additional Context <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <textarea
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Any extra details about why this claim should be approved…"
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={!selected || generating}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: 'var(--brand-orange)', color: '#07070A' }}
          >
            <Bot className="h-4 w-4" />
            {generating ? 'Generating…' : 'Generate Appeal Letter'}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Appeal Letter</label>
            {letter && (
              <button
                type="button"
                onClick={copy}
                className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}
              >
                {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          <div
            className="rounded-2xl p-4 min-h-64 text-sm whitespace-pre-wrap"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-edge)',
              color: letter ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {generating
              ? 'Generating appeal letter with AI…'
              : letter || 'Select a denied claim and click "Generate" to create an AI-powered appeal letter.'}
          </div>
        </div>
      </div>
    </div>
  )
}
