'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { SynapseLogo } from '../../../components/SynapseLogo'
import { createClient } from '../../../lib/supabase/client'

export default function PatientSignupPage() {
  const router = useRouter()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    dob: '',
    gender: '',
    password: '',
  })

  function set(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: `${form.first_name} ${form.last_name}`,
          role: 'patient',
        },
      },
    })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    if (data.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('profiles').upsert({
        id: data.user.id,
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: `${form.first_name} ${form.last_name}`,
        email: form.email,
        phone: form.phone || null,
        gender: form.gender || null,
        role: 'patient',
        onboarding_complete: false,
        verification_status: 'verified',
      })
    }
    router.push('/health/dashboard')
  }

  const inputCls = 'w-full rounded-xl px-4 py-3 text-sm outline-none transition-all'
  const inputStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-edge)',
    color: 'var(--text-primary)',
  }

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

        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Create patient account</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          Your personal health record starts here.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>First Name</label>
              <input
                required
                value={form.first_name}
                onChange={e => set('first_name', e.target.value)}
                placeholder="Jane"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Last Name</label>
              <input
                required
                value={form.last_name}
                onChange={e => set('last_name', e.target.value)}
                placeholder="Nakato"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Email Address</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="jane@example.com"
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Phone Number</label>
            <input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="+256 7XX XXX XXX"
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Date of Birth</label>
              <input
                type="date"
                value={form.dob}
                onChange={e => set('dob', e.target.value)}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Gender</label>
              <select
                value={form.gender}
                onChange={e => set('gender', e.target.value)}
                className={inputCls}
                style={{ ...inputStyle, WebkitAppearance: 'none', appearance: 'none' }}
              >
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
            <div className="relative">
              <input
                required
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Minimum 8 characters"
                className={`${inputCls} pr-10`}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !form.first_name || !form.email || !form.password}
            className="btn-primary w-full mt-2 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>
          By signing up, you agree to our{' '}
          <Link href="/legal/terms" style={{ color: 'var(--brand-orange)' }}>Terms</Link>{' '}
          and{' '}
          <Link href="/legal/privacy" style={{ color: 'var(--brand-orange)' }}>Privacy Policy</Link>.
        </p>

        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--brand-orange)' }}>Sign in</Link>
        </p>
      </div>
    </main>
  )
}
