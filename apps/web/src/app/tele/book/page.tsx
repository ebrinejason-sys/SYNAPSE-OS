'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, CheckCircle, Clock, Star } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface Provider {
  id: string
  full_name: string
  specialty: string
  rating: number | null
  consultation_fee_ugx: number | null
  languages: string[] | null
  bio: string | null
  years_experience: number | null
  is_available: boolean
}

const SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']

type Step = 'select' | 'time' | 'confirm' | 'done'

export default function TeleBookPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <TeleBookInner />
    </Suspense>
  )
}

function TeleBookInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const preselectedId = searchParams.get('providerId')
  const caseId = searchParams.get('caseId')

  const [providers, setProviders] = useState<Provider[]>([])
  const [selected, setSelected] = useState<Provider | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [complaint, setComplaint] = useState('')
  const [step, setStep] = useState<Step>(preselectedId ? 'time' : 'select')
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [apptId, setApptId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data } = await sb
        .from('telemedicine_providers')
        .select('id, full_name, specialty, rating, consultation_fee_ugx, languages, bio, years_experience, is_available')
        .eq('verification_status', 'approved')
        .eq('is_active', true)
        .order('is_available', { ascending: false })
        .order('rating', { ascending: false }) as { data: Provider[] | null }

      const list = data ?? []
      setProviders(list)

      if (preselectedId) {
        const found = list.find(p => p.id === preselectedId)
        if (found) setSelected(found)
      }
      setLoading(false)
    }
    load()
  }, [preselectedId])

  async function book() {
    if (!selected || !slot) return
    setBooking(true)
    const supabase = createClient()
    const meRes = await fetch('/api/auth/me')
    const { user } = meRes.ok ? await meRes.json() : { user: null }
    if (!user) { router.push('/login'); return }

    const scheduledFor = new Date()
    const parts = slot.split(':').map(Number)
    scheduledFor.setHours(parts[0] ?? 9, parts[1] ?? 0, 0, 0)
    if (scheduledFor < new Date()) scheduledFor.setDate(scheduledFor.getDate() + 1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    const { data: appt } = await sb.from('telemedicine_appointments').insert({
      patient_id: user.id,
      provider_id: selected.id,
      status: 'pending',
      chief_complaint: complaint || null,
      scheduled_for: scheduledFor.toISOString(),
      intake_case_id: caseId || null,
      consultation_fee_ugx: selected.consultation_fee_ugx,
    }).select('id').single() as { data: { id: string } | null }

    if (appt?.id) setApptId(appt.id)
    setBooking(false)
    setStep('done')
  }

  const fmt = (n: number | null) =>
    n ? new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n) : 'Free'

  if (step === 'done') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
        <div
          className="w-full max-w-sm rounded-3xl p-8 text-center"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
            <CheckCircle className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Appointment Booked</h1>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            {selected?.full_name} · {slot}
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
            You&apos;ll receive a confirmation. Join from your dashboard when it&apos;s time.
          </p>
          <div className="flex flex-col gap-2">
            {apptId && (
              <Link
                href={`/tele/room/${apptId}`}
                className="rounded-xl py-3 text-sm font-bold text-center"
                style={{ background: 'var(--brand-orange)', color: '#07070A' }}
              >
                Join Room
              </Link>
            )}
            <Link
              href="/tele"
              className="rounded-xl py-3 text-sm font-semibold text-center"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}
            >
              Back to Telemedicine
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <Link href="/tele" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Book a Consultation</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Step: Select Doctor */}
        {step === 'select' && (
          <>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Choose a verified doctor:</p>
            {loading ? (
              <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading doctors…</div>
            ) : (
              <div className="space-y-2">
                {providers.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelected(p); setStep('time') }}
                    className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all hover:border-orange-500/30"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0 font-bold text-lg"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}
                    >
                      {(p.full_name ?? 'D')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{p.full_name}</p>
                        {p.is_available && (
                          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>Online</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {p.specialty} · {fmt(p.consultation_fee_ugx)}
                      </p>
                    </div>
                    {p.rating && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Star className="h-3 w-3" style={{ color: '#EAB308' }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{Number(p.rating).toFixed(1)}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Step: Pick time */}
        {step === 'time' && selected && (
          <>
            <div
              className="flex items-center gap-4 rounded-2xl p-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0 font-bold text-lg"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}
              >
                {(selected.full_name ?? 'D')[0]}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{selected.full_name}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selected.specialty} · {fmt(selected.consultation_fee_ugx)}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep('select')}
                className="ml-auto text-xs"
                style={{ color: 'var(--brand-orange)' }}
              >
                Change
              </button>
            </div>

            <div>
              <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Calendar className="h-4 w-4" /> Pick a time slot
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SLOTS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className="rounded-xl py-3 text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
                    style={{
                      background: slot === s ? 'var(--brand-orange)' : 'var(--bg-surface)',
                      color: slot === s ? '#07070A' : 'var(--text-secondary)',
                      border: `1px solid ${slot === s ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
                    }}
                  >
                    <Clock className="h-3 w-3" /> {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text-primary)' }}>
                Chief Complaint <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <textarea
                value={complaint}
                onChange={e => setComplaint(e.target.value)}
                placeholder="Briefly describe your main concern…"
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
              />
            </div>

            <button
              type="button"
              onClick={() => setStep('confirm')}
              disabled={!slot}
              className="w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: 'var(--brand-orange)', color: '#07070A' }}
            >
              Continue
            </button>
          </>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && selected && slot && (
          <>
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Confirm Booking</h2>
              {[
                ['Doctor', selected.full_name],
                ['Specialty', selected.specialty],
                ['Time', slot],
                ['Fee', fmt(selected.consultation_fee_ugx)],
                complaint ? ['Complaint', complaint] : null,
              ].filter(Boolean).map(row => (
                <div key={row![0]} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>{row![0]}</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{row![1]}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('time')}
                className="flex-1 rounded-xl py-3 text-sm font-semibold"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={book}
                disabled={booking}
                className="flex-1 rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-60"
                style={{ background: 'var(--brand-orange)', color: '#07070A' }}
              >
                {booking ? 'Booking…' : 'Confirm Booking'}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
