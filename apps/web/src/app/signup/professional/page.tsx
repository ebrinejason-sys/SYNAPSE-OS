'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, CheckCircle, Eye, EyeOff, Upload } from 'lucide-react'
import { SynapseLogo } from '../../../components/SynapseLogo'

const SPECIALTIES = [
  'General Practice', 'Internal Medicine', 'Surgery', 'Paediatrics',
  'Obstetrics & Gynaecology', 'Emergency Medicine', 'Cardiology', 'Oncology',
  'Psychiatry', 'Radiology', 'Pharmacy', 'Nursing', 'Laboratory',
  'Physiotherapy', 'Anaesthesiology', 'Ophthalmology', 'Dermatology',
  'ENT', 'Orthopaedics', 'Dentistry', 'Public Health', 'Other',
]

type Step = 1 | 2 | 3 | 4 | 5
type CheckState = 'idle' | 'checking' | 'ok' | 'fail'

export default function ProfessionalSignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [docCheck, setDocCheck] = useState<CheckState>('idle')
  const [faceCheck, setFaceCheck] = useState<CheckState>('idle')

  const licenseRef = useRef<HTMLInputElement>(null)
  const selfieRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    gender: '', password: '',
    specialty: '', license_number: '', institution: '', years_experience: '',
    license_file: null as File | null,
    license_b64: '', license_mime: '',
    selfie_file: null as File | null,
    selfie_b64: '', selfie_mime: '',
  })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function fileToB64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleLicenseUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await fileToB64(file)
    setForm(prev => ({ ...prev, license_file: file, license_b64: b64, license_mime: file.type }))
    setDocCheck('idle')
  }

  async function handleSelfieUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const b64 = await fileToB64(file)
    setForm(prev => ({ ...prev, selfie_file: file, selfie_b64: b64, selfie_mime: file.type }))
    setFaceCheck('idle')
  }

  async function runDocCheck() {
    if (!form.license_b64) return
    setDocCheck('checking')
    try {
      const res = await fetch('/api/verification/document-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageB64: form.license_b64, mimeType: form.license_mime }),
      })
      const data = await res.json() as { valid: boolean }
      setDocCheck(data.valid ? 'ok' : 'fail')
    } catch {
      setDocCheck('fail')
    }
  }

  async function runFaceCheck() {
    if (!form.selfie_b64) return
    setFaceCheck('checking')
    try {
      const res = await fetch('/api/verification/face-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageB64: form.selfie_b64, mimeType: form.selfie_mime }),
      })
      const data = await res.json() as { valid: boolean }
      setFaceCheck(data.valid ? 'ok' : 'fail')
    } catch {
      setFaceCheck('fail')
    }
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/signup/professional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        gender: form.gender,
        password: form.password,
        specialty: form.specialty,
        license_number: form.license_number,
        institution: form.institution,
        years_experience: form.years_experience,
        license_b64: form.license_b64,
        license_mime: form.license_mime,
      }),
    })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) {
      setError(data.error ?? 'Could not submit application.')
      setLoading(false)
      return
    }

    setStep(5)
    setLoading(false)
  }

  const inp = 'w-full rounded-xl px-4 py-3 text-sm outline-none transition-all'
  const inpStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-edge)',
    color: 'var(--text-primary)',
  }

  const STEP_LABELS = ['Personal', 'Credentials', 'Documents', 'Face']

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Link href="/signup" className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <SynapseLogo size="sm" />
        </div>

        {/* Step bar */}
        {step < 5 && (
          <div className="flex items-center mb-8">
            {STEP_LABELS.map((label, i) => {
              const s = (i + 1) as Step
              const done = step > s
              const active = step === s
              return (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        background: done ? 'var(--brand-orange)' : active ? 'rgba(249,115,22,0.15)' : 'var(--bg-elevated)',
                        color: done ? '#07070A' : active ? 'var(--brand-orange)' : 'var(--text-muted)',
                        border: active ? '2px solid var(--brand-orange)' : done ? 'none' : '1px solid var(--border-edge)',
                      }}
                    >
                      {done ? '✓' : s}
                    </div>
                    <span className="text-[9px]" style={{ color: active ? 'var(--brand-orange)' : 'var(--text-muted)' }}>
                      {label}
                    </span>
                  </div>
                  {s < 4 && (
                    <div
                      className="flex-1 h-0.5 mx-2 mb-4"
                      style={{ background: done ? 'var(--brand-orange)' : 'var(--border-edge)' }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Step headings */}
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          {step === 1 && 'Professional Account'}
          {step === 2 && 'Your Credentials'}
          {step === 3 && 'Upload Documents'}
          {step === 4 && 'Face Verification'}
          {step === 5 && 'Application Submitted'}
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          {step === 1 && 'Create your Synapse professional profile.'}
          {step === 2 && 'Your medical licence and specialty details.'}
          {step === 3 && 'Upload your registration certificate or medical licence.'}
          {step === 4 && 'Upload a clear photo for identity verification.'}
          {step === 5 && "We'll review and verify your credentials within 24 hours."}
        </p>

        {/* ── Step 1: Personal ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>First Name</label>
                <input required value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Jane" className={inp} style={inpStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Last Name</label>
                <input required value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Nakato" className={inp} style={inpStyle} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="dr.nakato@hospital.ug" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+256 7XX XXX XXX" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Gender</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inp} style={{ ...inpStyle, WebkitAppearance: 'none', appearance: 'none' }}>
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other / Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
              <div className="relative">
                <input
                  required
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Minimum 8 characters"
                  className={`${inp} pr-10`}
                  style={inpStyle}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!form.first_name || !form.last_name || !form.email || form.password.length < 8}
              className="btn-primary w-full disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 2: Credentials ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Specialty</label>
              <select value={form.specialty} onChange={e => set('specialty', e.target.value)} className={inp} style={{ ...inpStyle, WebkitAppearance: 'none', appearance: 'none' }}>
                <option value="">Select specialty</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Medical Council Licence No.</label>
              <input required value={form.license_number} onChange={e => set('license_number', e.target.value)} placeholder="UMDPC-2024-XXXXX" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Institution / Hospital</label>
              <input value={form.institution} onChange={e => set('institution', e.target.value)} placeholder="Mulago National Referral Hospital" className={inp} style={inpStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Years of Experience</label>
              <input type="number" min="0" max="60" value={form.years_experience} onChange={e => set('years_experience', e.target.value)} placeholder="5" className={inp} style={inpStyle} />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
              <button type="button" onClick={() => setStep(3)} disabled={!form.specialty || !form.license_number} className="btn-primary flex-[2] disabled:opacity-50">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Documents ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Medical Licence / Registration Certificate</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Upload a clear photo or scan. JPG, PNG, or PDF — max 5 MB.</p>
              <input ref={licenseRef} type="file" accept="image/*,application/pdf" onChange={handleLicenseUpload} className="hidden" />
              <button
                type="button"
                onClick={() => licenseRef.current?.click()}
                className="w-full rounded-xl p-6 text-center transition-all flex flex-col items-center gap-3"
                style={{
                  background: form.license_file ? 'rgba(249,115,22,0.06)' : 'var(--bg-elevated)',
                  border: `2px dashed ${form.license_file ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
                  color: form.license_file ? 'var(--brand-orange)' : 'var(--text-muted)',
                }}
              >
                <Upload className="h-7 w-7" />
                <span className="text-sm font-medium">
                  {form.license_file ? form.license_file.name : 'Click to upload document'}
                </span>
              </button>
              {form.license_file && (
                <button
                  type="button"
                  onClick={runDocCheck}
                  disabled={docCheck === 'checking'}
                  className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold transition-all"
                  style={{
                    background: docCheck === 'ok' ? 'rgba(34,197,94,0.1)' : docCheck === 'fail' ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.1)',
                    color: docCheck === 'ok' ? '#22C55E' : docCheck === 'fail' ? '#EF4444' : 'var(--brand-orange)',
                    border: `1px solid ${docCheck === 'ok' ? 'rgba(34,197,94,0.3)' : docCheck === 'fail' ? 'rgba(239,68,68,0.3)' : 'var(--border-orange)'}`,
                  }}
                >
                  {docCheck === 'checking' && '⟳ AI checking document…'}
                  {docCheck === 'ok' && '✓ Document verified by AI'}
                  {docCheck === 'fail' && '✗ Could not verify — try a clearer image'}
                  {docCheck === 'idle' && '✦ Run AI document check'}
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1">Back</button>
              <button type="button" onClick={() => setStep(4)} disabled={!form.license_file} className="btn-primary flex-[2] disabled:opacity-50">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Face Verification ── */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Selfie Photo</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Clear, front-facing photo in good lighting. No sunglasses or face coverings.
              </p>
              <input ref={selfieRef} type="file" accept="image/*" capture="user" onChange={handleSelfieUpload} className="hidden" />
              <button
                type="button"
                onClick={() => selfieRef.current?.click()}
                className="w-full rounded-xl p-6 text-center transition-all flex flex-col items-center gap-3"
                style={{
                  background: form.selfie_file ? 'rgba(249,115,22,0.06)' : 'var(--bg-elevated)',
                  border: `2px dashed ${form.selfie_file ? 'var(--brand-orange)' : 'var(--border-edge)'}`,
                  color: form.selfie_file ? 'var(--brand-orange)' : 'var(--text-muted)',
                }}
              >
                {form.selfie_b64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${form.selfie_mime};base64,${form.selfie_b64}`}
                    alt="Selfie preview"
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <Camera className="h-7 w-7" />
                )}
                <span className="text-sm font-medium">
                  {form.selfie_file ? 'Change photo' : 'Take or upload selfie'}
                </span>
              </button>
              {form.selfie_file && (
                <button
                  type="button"
                  onClick={runFaceCheck}
                  disabled={faceCheck === 'checking'}
                  className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold transition-all"
                  style={{
                    background: faceCheck === 'ok' ? 'rgba(34,197,94,0.1)' : faceCheck === 'fail' ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.1)',
                    color: faceCheck === 'ok' ? '#22C55E' : faceCheck === 'fail' ? '#EF4444' : 'var(--brand-orange)',
                    border: `1px solid ${faceCheck === 'ok' ? 'rgba(34,197,94,0.3)' : faceCheck === 'fail' ? 'rgba(239,68,68,0.3)' : 'var(--border-orange)'}`,
                  }}
                >
                  {faceCheck === 'checking' && '⟳ AI scanning face…'}
                  {faceCheck === 'ok' && '✓ Face detected — verified'}
                  {faceCheck === 'fail' && '✗ Could not detect face clearly — try again'}
                  {faceCheck === 'idle' && '✦ Run AI face check'}
                </button>
              )}
            </div>

            {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(3)} className="btn-secondary flex-1">Back</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !form.selfie_file}
                className="btn-primary flex-[2] disabled:opacity-50"
              >
                {loading ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Complete ── */}
        {step === 5 && (
          <div className="text-center py-4">
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(34,197,94,0.12)' }}>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Application Submitted!</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Our team will verify your credentials within 24 hours. You&apos;ll receive an email confirmation when approved.
            </p>
            <div
              className="rounded-xl p-4 mb-6 text-left space-y-2"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>WHAT HAPPENS NEXT</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>1. Our team reviews your licence and credentials</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>2. You receive email confirmation with your login link</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>3. Connect to a Synapse-registered hospital to begin</p>
            </div>
            <Link href="/" className="btn-primary inline-block px-8">
              Back to Home
            </Link>
          </div>
        )}

        {step < 5 && (
          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--brand-orange)' }}>Sign in</Link>
          </p>
        )}
      </div>
    </main>
  )
}
