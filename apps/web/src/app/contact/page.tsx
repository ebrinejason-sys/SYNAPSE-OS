'use client'
import { useState } from 'react'
import Link from 'next/link'
import { SynapseLogo } from '../../components/SynapseLogo'
import { ThemeToggle } from '../../components/ThemeToggle'

const SUBJECTS = [
  'General enquiry',
  'Pilot access / Hospital onboarding',
  'Enterprise & large-scale deployment',
  'Partnership & integration',
  'Press & media',
  'Technical support',
  'Investment enquiry',
]

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [intent, setIntent] = useState('General')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  function set(k: keyof typeof form, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, intent }),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl text-sm outline-none transition-all'
  const inputStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-edge)',
    color: 'var(--text-primary)',
  }

  return (
    <main style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5"
        style={{
          background: 'var(--nav-glass)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <Link href="/"><SynapseLogo size="md" /></Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/apply"
            className="text-sm font-bold px-4 py-2 rounded-xl transition-all"
            style={{ background: 'var(--brand-orange)', color: '#07070A' }}
          >
            Apply for Access
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p
            className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--brand-gold)', letterSpacing: '0.12em' }}
          >
            Get in touch
          </p>
          <h1
            className="font-display font-bold mb-4"
            style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            Talk to the team
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Whether you&rsquo;re a hospital administrator, investor, or partner, every message goes directly to the founders.
          </p>
        </div>

        {status === 'success' ? (
          <div
            className="p-10 rounded-2xl text-center"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)', animation: 'fadeInUp 0.4s ease forwards' }}
          >
            <div
              className="inline-flex items-center justify-center rounded-full mb-6 font-bold text-xl"
              style={{ width: '3.5rem', height: '3.5rem', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E' }}
            >
              &#10003;
            </div>
            <h2 className="font-display font-bold text-xl mb-3">Message sent.</h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
              We&rsquo;ve received your message and sent a confirmation to your email. We&rsquo;ll reply within 24 hours.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <div
            className="p-8 rounded-2xl"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
          >
            {/* Intent chips */}
            <div className="mb-8">
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
                What&rsquo;s this about?
              </p>
              <div className="flex flex-wrap gap-2">
                {['General', 'Hospital pilot', 'Enterprise', 'Partnership', 'Press', 'Investment'].map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIntent(i)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: intent === i ? 'rgba(249,115,22,0.15)' : 'var(--bg-elevated)',
                      color: intent === i ? 'var(--brand-orange)' : 'var(--text-secondary)',
                      border: `1px solid ${intent === i ? 'var(--border-orange)' : 'var(--border-edge)'}`,
                    }}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Your Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="Dr. Jane Nakato"
                    className={inputCls}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Email Address *
                  </label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="you@hospital.ug"
                    className={inputCls}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Subject
                </label>
                <select
                  value={form.subject}
                  onChange={e => set('subject', e.target.value)}
                  title="Message subject"
                  className={inputCls}
                  style={{ ...inputStyle, appearance: 'none' }}
                >
                  <option value="">Select a topic</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Message *
                </label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => set('message', e.target.value)}
                  placeholder="Tell us about your hospital, the challenge you're facing, or what you'd like to explore..."
                  className={`${inputCls} resize-none`}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--brand-orange)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-edge)')}
                />
              </div>

              {status === 'error' && (
                <p className="text-xs" style={{ color: '#EF4444' }}>
                  Something went wrong. Please try again or email us directly at{' '}
                  <a href="mailto:synapseostech@gmail.com" style={{ color: 'var(--brand-orange)' }}>synapseostech@gmail.com</a>
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'loading' || !form.name || !form.email || !form.message}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: 'var(--brand-orange)',
                  color: '#07070A',
                  opacity: status === 'loading' || !form.name || !form.email || !form.message ? 0.6 : 1,
                }}
              >
                {status === 'loading' ? 'Sending...' : 'Send Message'}
              </button>

              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                We reply to every message within 24 hours.
              </p>
            </form>
          </div>
        )}

        {/* Direct contact */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'SYNAPSE', value: 'synapseostech@gmail.com', href: 'mailto:synapseostech@gmail.com' },
            { label: 'Nathan (Clinical Lead)', value: 'nathandavid762@gmail.com', href: 'mailto:nathandavid762@gmail.com' },
          ].map(c => (
            <a
              key={c.label}
              href={c.href}
              className="flex items-center gap-3 p-4 rounded-xl transition-all hover:border-orange-500/30"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}
            >
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
