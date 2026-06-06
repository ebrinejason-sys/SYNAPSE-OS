'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, CheckCircle, ShieldCheck, Smartphone } from 'lucide-react'
import { createClient } from '../../../../lib/supabase/client'

type Step = 'idle' | 'enrolling' | 'verifying' | 'done' | 'already_enrolled'

export default function AdminMFAPage() {
  const [step, setStep] = useState<Step>('idle')
  const [qrUrl, setQrUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    async function checkEnrollment() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserEmail(user.email ?? '')

      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasTotp = factors?.totp?.some(f => f.status === 'verified')
      if (hasTotp) setStep('already_enrolled')
    }
    checkEnrollment()
  }, [])

  async function startEnrollment() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Synapse Admin App',
    })
    if (enrollErr || !data) {
      setError(enrollErr?.message ?? 'Failed to start enrollment')
      setLoading(false)
      return
    }
    setQrUrl(data.totp.qr_code)
    setSecret(data.totp.secret)
    setFactorId(data.id)

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: data.id })
    if (challengeErr || !challenge) {
      setError(challengeErr?.message ?? 'Failed to create challenge')
      setLoading(false)
      return
    }
    setChallengeId(challenge.id)
    setStep('enrolling')
    setLoading(false)
  }

  async function verifyCode() {
    if (code.length !== 6) { setError('Enter the 6-digit code from your app'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    })
    if (verifyErr) {
      setError(verifyErr.message)
      setLoading(false)
      return
    }
    setStep('done')
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/settings" className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Authenticator App (TOTP)</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Secure your admin account with a time-based one-time password.
        </p>
      </div>

      {step === 'already_enrolled' && (
        <div className="flex items-start gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <CheckCircle className="h-5 w-5 mt-0.5 shrink-0 text-green-500" />
          <div>
            <p className="text-sm font-semibold text-green-500">Authenticator already set up</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {userEmail} has an active TOTP factor. You can manage factors in your Supabase Auth settings.
            </p>
          </div>
        </div>
      )}

      {step === 'idle' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'rgba(249,115,22,0.12)' }}>
                <Smartphone className="h-5 w-5" style={{ color: 'var(--brand-orange)' }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Set up your authenticator</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Use Google Authenticator, Authy, or any TOTP app
                </p>
              </div>
            </div>
            <ol className="space-y-1.5 text-xs pl-2" style={{ color: 'var(--text-secondary)' }}>
              <li>1. Click <strong>Start Setup</strong> below</li>
              <li>2. Open your authenticator app and scan the QR code</li>
              <li>3. Enter the 6-digit code to verify</li>
            </ol>
          </div>

          <button
            type="button"
            onClick={startEnrollment}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            {loading ? 'Starting…' : 'Start Setup'}
          </button>
        </div>
      )}

      {step === 'enrolling' && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Scan with your authenticator app</p>
            {qrUrl && (
              <div className="flex justify-center mb-3">
                <Image src={qrUrl} alt="TOTP QR Code" width={180} height={180} unoptimized
                  style={{ borderRadius: 12, background: '#fff', padding: 8 }} />
              </div>
            )}
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Can't scan? Enter this secret manually:</p>
            <code className="text-xs break-all px-3 py-1.5 rounded-lg block"
              style={{ background: 'rgba(249,115,22,0.08)', color: 'var(--brand-orange)', letterSpacing: '0.05em' }}>
              {secret}
            </code>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Enter 6-digit code from your app
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}

          <button
            type="button"
            onClick={verifyCode}
            disabled={loading || code.length !== 6}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify & Activate'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center text-center py-8 space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'rgba(34,197,94,0.12)' }}>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Authenticator activated!</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Your account is now protected with TOTP. You'll be asked for a code on each login.
            </p>
          </div>
          <Link href="/admin/settings" className="btn-primary">Back to Settings</Link>
        </div>
      )}
    </div>
  )
}
