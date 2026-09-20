'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type LetterResponse = {
  letter?: { renderedSnapshot: string; status: string; contentHash: string; signedAt?: string | null }
  verification?: { id: string; phi: boolean }
  error?: string
}

export default function ReferralLetterPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [data, setData] = useState<LetterResponse | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/facility/referral/letter?id=${id}`)
      const body = await res.json()
      if (!cancelled) setData(res.ok ? body : { error: body.error || `Failed (${res.status})` })
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  async function sign() {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/facility/referral/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`)
      setData((current) => ({ ...current, letter: body.letter, verification: body.verification }))
      setStatus('Letter signed and locked')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="clinical-page mx-auto max-w-3xl px-4 py-8 print:max-w-none print:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/referrals/${id}`} className="text-sm text-muted-color">
          ← Referral
        </Link>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl border border-subtle px-3 py-2 text-sm" onClick={() => window.print()}>
            Print / PDF
          </button>
          <button type="button" className="rounded-xl bg-[var(--brand-orange)] px-3 py-2 text-sm text-white disabled:opacity-40" onClick={() => void sign()} disabled={busy || data?.letter?.status === 'signed'}>
            Sign letter
          </button>
        </div>
      </div>
      <h1 className="mt-4 font-display text-2xl text-primary-color">Referral letter</h1>
      <p className="mt-1 text-xs text-muted-color">
        QR verification uses a secure facility reference only. It does not encode patient name, diagnosis, or other PHI.
      </p>
      {data?.verification ? (
        <p className="mt-2 font-mono text-xs text-muted-color">
          Verify: {data.verification.id} · PHI in QR: {data.verification.phi ? 'yes' : 'no'}
        </p>
      ) : null}
      {data?.error ? <p className="mt-6 text-sm text-red-500">{data.error}</p> : null}
      {data?.letter ? (
        <pre className="clinical-card mt-6 whitespace-pre-wrap p-6 text-sm leading-6 text-primary-color">
          {data.letter.renderedSnapshot}
        </pre>
      ) : null}
      {data?.letter?.contentHash ? <p className="mt-3 font-mono text-[11px] text-muted-color">Hash {data.letter.contentHash}</p> : null}
      {status ? <p className="mt-4 text-sm text-secondary-color print:hidden">{status}</p> : null}
    </main>
  )
}
