'use client'
import { useState } from 'react'
import Link from 'next/link'
import { SynapseLogo } from '../../components/SynapseLogo'
import { ThemeToggle } from '../../components/ThemeToggle'

type Step = 1 | 2 | 3
type Role = 'clinician' | 'nurse' | 'pharmacist' | 'lab' | 'admin' | 'it' | 'other'

const ROLES: { value: Role; label: string }[] = [
  { value: 'clinician',   label: 'Clinician / Doctor' },
  { value: 'nurse',       label: 'Nurse / Midwife' },
  { value: 'pharmacist',  label: 'Pharmacist' },
  { value: 'lab',         label: 'Lab Technician / Scientist' },
  { value: 'admin',       label: 'Hospital Administrator' },
  { value: 'it',          label: 'Health IT / Systems' },
  { value: 'other',       label: 'Other' },
]

const SPECIALTIES = [
  'General Practice', 'Internal Medicine', 'Paediatrics', 'Obstetrics & Gynaecology',
  'Surgery', 'Emergency Medicine', 'Radiology', 'Anaesthesia',
  'Psychiatry', 'Ophthalmology', 'ENT', 'Dermatology', 'Oncology',
  'Cardiology', 'Neurology', 'Other',
]

const INTERESTS = [
  'Clinical AI (Diagnosis)', 'Lab & Results', 'Pharmacy & Prescriptions',
  'Patient Records (EMR)', 'Telemedicine', 'Insurance & Billing',
  'Public Health Reports', 'Research & Analytics',
]

interface FormData {
  // Step 1 — Personal
  fullName: string
  email: string
  phone: string
  role: Role | ''
  specialty: string
  licenseNumber: string
  // Step 2 — Hospital
  hospitalName: string
  location: string
  hospitalType: string
  bedCount: string
  currentSystem: string
  // Step 3 — Interests
  interests: string[]
  message: string
  hearAboutUs: string
}

const EMPTY: FormData = {
  fullName: '', email: '', phone: '', role: '', specialty: '', licenseNumber: '',
  hospitalName: '', location: '', hospitalType: '', bedCount: '', currentSystem: '',
  interests: [], message: '', hearAboutUs: '',
}

const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-edge)',
  color: 'var(--text-primary)',
  borderRadius: '12px',
  padding: '11px 14px',
  fontSize: '14px',
  width: '100%',
  outline: 'none',
  ...extra,
})

export default function ApplyProfessionalPage() {
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function set(k: keyof FormData, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleInterest(interest: string) {
    setForm(f => ({
      ...f,
      interests: f.interests.includes(interest)
        ? f.interests.filter(i => i !== interest)
        : [...f.interests, interest],
    }))
  }

  function canNext() {
    if (step === 1) return !!(form.fullName && form.email && form.role)
    if (step === 2) return !!(form.hospitalName && form.location)
    return true
  }

  async function submit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/applications/professional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Submission failed')
      setDone(true)
    } catch {
      setError('Submission failed. Please email us directly at ebrinetushabe@gmail.com')
    } finally {
      setLoading(false)
    }
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-muted)' }

  if (done) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center max-w-sm px-4">
          <div
            className="inline-flex items-center justify-center rounded-full mb-6"
            style={{ width: '64px', height: '64px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="font-display font-bold text-2xl mb-2" style={{ letterSpacing: '-0.02em' }}>Application received.</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Thank you, {form.fullName.split(' ')[0]}. We review every application personally and will be in touch within 24 hours.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="https://demo.synapseos.tech"
              className="block py-3 rounded-xl font-bold text-sm"
              style={{ background: 'var(--brand-orange)', color: '#07070A', textDecoration: 'none' }}
            >
              Try the Live Demo
            </a>
            <Link
              href="/"
              className="block py-3 rounded-xl font-semibold text-sm"
              style={{ border: '1px solid var(--border-edge)', color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--nav-glass)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/"><SynapseLogo size="md" /></Link>
        <ThemeToggle />
      </nav>

      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {([1, 2, 3] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="flex items-center justify-center rounded-full text-xs font-bold"
                style={{
                  width: '30px', height: '30px', flexShrink: 0,
                  background: step >= s ? 'var(--brand-orange)' : 'var(--bg-elevated)',
                  color: step >= s ? '#07070A' : 'var(--text-muted)',
                  border: step >= s ? 'none' : '1px solid var(--border-edge)',
                }}
              >
                {step > s ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : s}
              </div>
              {i < 2 && (
                <div style={{ flex: 1, height: '1px', background: step > s ? 'var(--brand-orange)' : 'var(--border-edge)', minWidth: '40px' }} />
              )}
            </div>
          ))}
        </div>

        {/* Step labels */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl mb-1" style={{ letterSpacing: '-0.02em' }}>
            {step === 1 && 'About you'}
            {step === 2 && 'Your hospital'}
            {step === 3 && 'Areas of interest'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {step === 1 && 'Tell us about your professional background.'}
            {step === 2 && 'Where do you work and what systems are in use?'}
            {step === 3 && 'Which modules are most relevant to your role?'}
          </p>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Dr. Jane Nakato" style={inp()} />
            </div>
            <div>
              <label style={labelStyle}>Work Email *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@hospital.ug" style={inp()} />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+256 7XX XXX XXX" style={inp()} />
            </div>
            <div>
              <label style={labelStyle}>Your Role *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} style={inp()}>
                <option value="">Select your role…</option>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {(form.role === 'clinician') && (
              <div>
                <label style={labelStyle}>Specialty</label>
                <select value={form.specialty} onChange={e => set('specialty', e.target.value)} style={inp()}>
                  <option value="">Select specialty…</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Professional License / Registration Number</label>
              <input value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} placeholder="MDC / NMC / PSB number" style={inp()} />
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label style={labelStyle}>Hospital / Facility Name *</label>
              <input value={form.hospitalName} onChange={e => set('hospitalName', e.target.value)} placeholder="Mulago National Referral Hospital" style={inp()} />
            </div>
            <div>
              <label style={labelStyle}>Location (District, Country) *</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Kampala, Uganda" style={inp()} />
            </div>
            <div>
              <label style={labelStyle}>Facility Type</label>
              <select value={form.hospitalType} onChange={e => set('hospitalType', e.target.value)} style={inp()}>
                <option value="">Select type…</option>
                <option>National Referral Hospital</option>
                <option>Regional Referral Hospital</option>
                <option>General / District Hospital</option>
                <option>Private Hospital / Clinic</option>
                <option>Health Centre IV</option>
                <option>Health Centre III</option>
                <option>PNFP / Faith-Based Facility</option>
                <option>NGO Health Facility</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Approximate Bed Count</label>
              <input type="number" value={form.bedCount} onChange={e => set('bedCount', e.target.value)} placeholder="e.g. 120" style={inp()} />
            </div>
            <div>
              <label style={labelStyle}>Current Health System / Software</label>
              <input value={form.currentSystem} onChange={e => set('currentSystem', e.target.value)} placeholder="Paper records, DHIS2, OpenMRS, Slade360…" style={inp()} />
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label style={labelStyle}>Modules of Interest (select all that apply)</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {INTERESTS.map(interest => {
                  const active = form.interests.includes(interest)
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: active ? 'rgba(249,115,22,0.15)' : 'var(--bg-elevated)',
                        color: active ? 'var(--brand-orange)' : 'var(--text-secondary)',
                        border: `1px solid ${active ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {interest}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle}>How did you hear about Synapse OS?</label>
              <select value={form.hearAboutUs} onChange={e => set('hearAboutUs', e.target.value)} style={inp()}>
                <option value="">Select…</option>
                <option>Colleague / Referral</option>
                <option>Social Media</option>
                <option>Conference / Event</option>
                <option>Google / Search</option>
                <option>MOH / Government</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Anything else you'd like to share?</label>
              <textarea
                value={form.message}
                onChange={e => set('message', e.target.value)}
                placeholder="Specific challenges, timelines, or questions…"
                rows={4}
                style={{ ...inp(), resize: 'none' }}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(s => (s - 1) as Step)}
              className="px-5 py-3 rounded-xl font-semibold text-sm"
              style={{ border: '1px solid var(--border-edge)', color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer' }}
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => step < 3 ? setStep(s => (s + 1) as Step) : submit()}
            disabled={!canNext() || loading}
            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
            style={{
              background: canNext() && !loading ? 'var(--brand-orange)' : 'rgba(249,115,22,0.35)',
              color: '#07070A',
              cursor: canNext() && !loading ? 'pointer' : 'not-allowed',
              border: 'none',
            }}
          >
            {loading ? 'Submitting…' : step < 3 ? 'Continue' : 'Submit Application'}
          </button>
        </div>

        <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>
          Looking to register a hospital?{' '}
          <Link href="/apply" style={{ color: 'var(--brand-orange)' }}>Apply for Pilot Access →</Link>
        </p>
      </div>
    </main>
  )
}
