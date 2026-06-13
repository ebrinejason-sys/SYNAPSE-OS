'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, MessageSquare, Star, Video } from 'lucide-react'
import { createClient } from '../../lib/supabase/client'
import { SynapseLogo } from '../../components/SynapseLogo'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

interface Provider {
  id: string
  full_name: string
  specialty: string
  rating: number | null
  languages: string[] | null
  is_available: boolean
  years_experience: number | null
}

interface Appointment {
  id: string
  status: string
  chief_complaint: string | null
  scheduled_for: string | null
  provider_id: string | null
}

export default function TelePage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const user = await getCurrentUser()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const [provRes, apptRes] = await Promise.all([
        sb.from('telemedicine_providers')
          .select('id, full_name, specialty, rating, languages, is_available, years_experience')
          .eq('verification_status', 'approved')
          .eq('is_active', true)
          .order('rating', { ascending: false })
          .limit(6) as Promise<{ data: Provider[] | null }>,
        user ? sb.from('telemedicine_appointments')
          .select('id, status, chief_complaint, scheduled_for, provider_id')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5) as Promise<{ data: Appointment[] | null }> : Promise.resolve({ data: [] as Appointment[] }),
      ])

      setProviders(provRes.data ?? [])
      setAppointments(apptRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <SynapseLogo size="sm" />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Telemedicine</span>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Hero CTA */}
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(232,184,75,0.1))',
            border: '1px solid var(--border-orange)',
          }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--brand-orange)' }}
          >
            <Video className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Consult a Doctor Now
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Speak with a verified Ugandan doctor from anywhere. AI-assisted triage and instant booking.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/tele/intake"
              className="btn-primary flex items-center gap-2 text-sm px-6"
            >
              <MessageSquare className="h-4 w-4" /> Start Intake
            </Link>
            <Link
              href="/tele/book"
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}
            >
              <Calendar className="h-4 w-4" /> Book a Doctor
            </Link>
          </div>
        </div>

        {/* Available Doctors */}
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>AVAILABLE DOCTORS</h2>
          {loading ? (
            <div className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading doctors…</div>
          ) : providers.length === 0 ? (
            <div className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No doctors available right now.</div>
          ) : (
            <div className="space-y-2">
              {providers.map(p => (
                <Link
                  key={p.id}
                  href={`/tele/book?providerId=${p.id}`}
                  className="flex items-center gap-4 rounded-2xl p-4 transition-all hover:border-orange-500/30"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0 text-lg font-bold"
                    style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}
                  >
                    {(p.full_name ?? 'D')[0]!.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{p.full_name}</p>
                      {p.is_available && (
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                          Online
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {p.specialty} {p.years_experience ? `· ${p.years_experience} yrs exp` : ''}
                    </p>
                  </div>
                  {p.rating && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className="h-3.5 w-3.5" style={{ color: '#EAB308' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {Number(p.rating).toFixed(1)}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Past appointments */}
        {appointments.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>RECENT CONSULTATIONS</h2>
            <div className="space-y-2">
              {appointments.map(a => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
                >
                  <Clock className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {a.chief_complaint ?? 'Consultation'}
                    </p>
                    {a.scheduled_for && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(a.scheduled_for).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xs rounded-full px-2 py-0.5 capitalize shrink-0"
                    style={{
                      background: a.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
                      color: a.status === 'completed' ? '#22C55E' : '#EAB308',
                    }}
                  >
                    {a.status}
                  </span>
                  {a.status === 'confirmed' && (
                    <Link
                      href={`/tele/room/${a.id}`}
                      className="text-xs rounded-lg px-2 py-1 shrink-0"
                      style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}
                    >
                      Join
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
