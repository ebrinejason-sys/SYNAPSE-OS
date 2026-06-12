'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { SynapseLogo } from '../../components/SynapseLogo'
import { ThemeToggle } from '../../components/ThemeToggle'

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Hospital { id: string; name: string; subdomain: string | null; type: string | null; created_at: string }
interface AuditEntry { id: string; table_name: string; action: string; user_role: string | null; created_at: string }
interface WaitlistEntry { id: string; created_at: string }
interface RecentUser { id: string; full_name: string | null; email: string | null; role: string; created_at: string }
interface Stats {
  hospitals: Hospital[]
  totalProfiles: number
  newSignups: number
  auditLog: AuditEntry[]
  waitlist: WaitlistEntry[]
  totalPatients: number
  encountersToday: number
  recentUsers: RecentUser[]
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)  return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

function actionColor(action: string) {
  if (action === 'INSERT') return '#22C55E'
  if (action === 'UPDATE') return '#E8B84B'
  if (action === 'DELETE') return '#EF4444'
  return '#A0A0B0'
}

/* ─── Stat Card ─────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="p-5 rounded-2xl flex flex-col gap-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-display font-black" style={{ fontSize: 'clamp(1.6rem,3vw,2.2rem)', lineHeight: 1, color: color ?? 'var(--text-primary)' }}>
        {value}
      </p>
      {sub && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function FounderCommandPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const router = useRouter()

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/founder/stats')
      if (res.status === 401 || res.status === 403) {
        router.push('/login?next=/founder')
        return
      }
      const data = await res.json()
      setStats(data)
      setLastSync(new Date())
      setError('')
    } catch {
      setError('Failed to load platform data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 60_000) // refresh every minute
    return () => clearInterval(interval)
  }, [fetchStats])

  async function loadAiInsight() {
    if (!stats || insightLoading) return
    setInsightLoading(true)
    setAiInsight(null)
    try {
      const res = await fetch('/api/ai/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are an AI advisor for Synapse OS, a sovereign health HMIS platform built for African hospitals.
Based on these platform metrics: ${stats.hospitals.length} hospitals onboarded, ${stats.totalPatients} patients in the system, ${stats.newSignups} new user signups in the last 7 days, ${stats.encountersToday} clinical encounters today, ${stats.waitlist.length} APK beta waitlist entries.
The recent activity shows: ${stats.auditLog.slice(0,5).map(a => a.action + ' on ' + a.table_name).join(', ')}.
Provide 3 concise, specific, actionable strategic insights for the founders in plain text. Focus on growth, product priorities, and operational health. Each insight on its own line starting with a number.`,
        }),
      })
      const data = await res.json()
      setAiInsight(data.result ?? data.text ?? data.content ?? 'No insights returned.')
    } catch {
      setAiInsight('Could not load AI insights. Check the Gemini API key.')
    } finally {
      setInsightLoading(false)
    }
  }

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main style={{ background: 'var(--bg-base)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <div style={{
            width: '3rem', height: '3rem', borderRadius: '50%',
            border: '3px solid var(--border-edge)', borderTopColor: 'var(--brand-orange)',
            animation: 'rotateSlow 0.9s linear infinite', margin: '0 auto 1rem',
          }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading command data…</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main style={{ background: 'var(--bg-base)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <p style={{ color: '#EF4444', marginBottom: '1rem' }}>{error}</p>
          <button onClick={fetchStats} className="px-5 py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--brand-orange)', color: '#07070A' }}>Retry</button>
        </div>
      </main>
    )
  }

  const s = stats!

  return (
    <main style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
        style={{ background: 'var(--nav-glass)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-4">
          <Link href="/"><SynapseLogo size="sm" /></Link>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--brand-orange)', border: '1px solid var(--border-orange)', letterSpacing: '0.06em' }}
          >
            SOVEREIGN COMMAND
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-xs hidden md:block" style={{ color: 'var(--text-muted)' }}>
              Synced {timeAgo(lastSync.toISOString())}
            </span>
          )}
          <button onClick={fetchStats} title="Refresh" className="text-xs px-3 py-1.5 rounded-lg transition-all" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-secondary)' }}>
            ↺ Refresh
          </button>
          <ThemeToggle />
          <button onClick={handleSignOut} className="text-xs px-3 py-1.5 rounded-lg transition-all" style={{ color: 'var(--text-muted)', border: '1px solid var(--border-edge)', background: 'transparent' }}>
            Sign out
          </button>
        </div>
      </header>

      <div className="px-6 py-8" style={{ maxWidth: '88rem', margin: '0 auto' }}>

        {/* ── Resend domain notice ────────────────────────────────────── */}
        <div className="mb-6 flex items-start gap-3 px-5 py-4 rounded-xl" style={{ background: 'rgba(234,101,0,0.08)', border: '1px solid rgba(234,101,0,0.3)' }}>
          <span style={{ color: 'var(--brand-orange)', fontSize: '1rem', flexShrink: 0 }}>⚠</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--brand-orange)' }}>Action required: Verify synapseos.tech in Resend</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Email delivery is blocked until DNS records are added. Go to{' '}
              <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-orange)', textDecoration: 'underline' }}>resend.com/domains</a>
              {' '}→ Add Domain → synapseos.tech → copy the TXT/CNAME records into your DNS panel.
            </p>
          </div>
        </div>

        {/* ── KPI pulse ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Hospitals Onboarded"  value={s.hospitals.length}     sub="Total tenants"           color="var(--brand-orange)" />
          <StatCard label="Platform Users"        value={s.totalProfiles}        sub="All profiles"            color="var(--brand-gold)"   />
          <StatCard label="New Signups (7d)"      value={s.newSignups}           sub="Last 7 days"             color="#22C55E"             />
          <StatCard label="Encounters Today"      value={s.encountersToday}      sub="Clinical encounters 24h" color="#38BDF8"             />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Patients"        value={s.totalPatients.toLocaleString()} sub="In database"         />
          <StatCard label="APK Waitlist"          value={s.waitlist.length}      sub="Beta app signups"               />
          <StatCard label="Audit Events (recent)" value={s.auditLog.length}      sub="Last 60 events loaded"          />
          <StatCard label="Recent Users"          value={s.recentUsers.length}   sub="Joined last 7 days"             />
        </div>

        {/* ── Main grid: Activity + Hospitals ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* Activity Feed */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="font-display font-bold text-sm">Activity Feed</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }}>
                ● Live
              </span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
              {s.auditLog.length === 0 ? (
                <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-muted)' }}>No audit events yet.</p>
              ) : s.auditLog.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0"
                    style={{ background: `${actionColor(ev.action)}18`, color: actionColor(ev.action), border: `1px solid ${actionColor(ev.action)}40`, fontSize: '0.6rem', letterSpacing: '0.04em' }}
                  >
                    {ev.action}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ev.table_name}</p>
                    {ev.user_role && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ev.user_role}</p>}
                  </div>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{timeAgo(ev.created_at)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hospitals */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="font-display font-bold text-sm">Onboarded Hospitals</p>
              <Link href="/admin" className="text-xs px-3 py-1 rounded-lg transition-all" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}>
                Full Admin →
              </Link>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
              {s.hospitals.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No hospitals yet. Start onboarding your first facility.</p>
                  <Link href="/admin" className="text-xs px-4 py-2 rounded-xl font-semibold" style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
                    Open Admin Panel
                  </Link>
                </div>
              ) : s.hospitals.map(h => (
                <div key={h.id} className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div
                    className="flex items-center justify-center rounded-xl font-bold shrink-0"
                    style={{ width: '2rem', height: '2rem', background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)', fontSize: '0.65rem', border: '1px solid var(--border-orange)' }}
                  >
                    {h.name.slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{h.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {h.subdomain ? `${h.subdomain}.synapseos.tech` : h.type ?? 'Hospital'}
                    </p>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{timeAgo(h.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Signups ───────────────────────────────────────────── */}
        {s.recentUsers.length > 0 && (
          <div className="mb-8 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="font-display font-bold text-sm">New Users This Week</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Name','Email','Role','Joined'].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.recentUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-5 py-3 text-sm font-medium">{u.full_name ?? '—'}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{u.email ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(232,184,75,0.1)', color: 'var(--brand-gold)', border: '1px solid var(--border-gold)' }}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── AI Strategic Insights ────────────────────────────────────── */}
        <div className="mb-8 p-6 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-display font-bold text-sm mb-1">AI Strategic Insights</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Gemini analyses your platform metrics and surfaces priorities</p>
            </div>
            <button
              onClick={loadAiInsight}
              disabled={insightLoading}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
              style={{ background: insightLoading ? 'var(--bg-elevated)' : 'var(--brand-orange)', color: insightLoading ? 'var(--text-muted)' : '#07070A', opacity: insightLoading ? 0.7 : 1 }}
            >
              {insightLoading ? 'Thinking…' : aiInsight ? '↺ Refresh Insights' : '✦ Generate Insights'}
            </button>
          </div>

          {aiInsight ? (
            <div className="p-5 rounded-xl text-sm leading-relaxed whitespace-pre-line" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-edge)' }}>
              {aiInsight}
            </div>
          ) : (
            <div className="p-5 rounded-xl text-sm text-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
              Click &ldquo;Generate Insights&rdquo; to get Gemini&rsquo;s read on the platform based on live data.
            </div>
          )}
        </div>

        {/* ── Quick Actions + Social + Platform ────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

          {/* Quick actions */}
          <div className="p-5 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <p className="font-display font-bold text-sm mb-4">Platform Controls</p>
            <div className="space-y-2">
              {[
                { label: 'Admin Dashboard',     href: '/admin',           badge: null },
                { label: 'Hospital Onboarding', href: '/onboarding',      badge: null },
                { label: 'Feature Flags',       href: '/admin',           badge: 'Admin' },
                { label: 'System Status',       href: '/status',          badge: null },
                { label: 'All Doctors/Staff',   href: '/admin',           badge: null },
                { label: 'Demo Mode',           href: '/demo/admin',      badge: 'Demo' },
              ].map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                >
                  {item.label}
                  {item.badge && (
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}>{item.badge}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Social Automation */}
          <div className="p-5 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <p className="font-display font-bold text-sm mb-1">Social Automation</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Configure API keys to enable auto-posting</p>
            <div className="space-y-3">
              {[
                { name: 'X (Twitter)',  key: 'TWITTER_API_KEY',      configured: false, color: '#1D9BF0' },
                { name: 'Instagram',    key: 'INSTAGRAM_ACCESS_TOKEN', configured: false, color: '#E1306C' },
                { name: 'LinkedIn',     key: 'LINKEDIN_ACCESS_TOKEN', configured: false, color: '#0A66C2' },
                { name: 'Resend Email', key: 'RESEND_API_KEY',        configured: true,  color: '#22C55E' },
              ].map(ch => (
                <div key={ch.name} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <span className="text-sm font-medium">{ch.name}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: ch.configured ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: ch.configured ? '#22C55E' : '#EF4444', border: `1px solid ${ch.configured ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                    {ch.configured ? '✓ Active' : '✗ Not set'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Add keys to .env.local and configure posting schedules from the admin panel.</p>
          </div>

          {/* Security */}
          <div className="p-5 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <p className="font-display font-bold text-sm mb-1">Security &amp; 2FA Status</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Founder account security overview</p>
            <div className="space-y-3">
              {[
                { label: 'Supabase RLS',          status: 'Active',     ok: true },
                { label: 'Ebrine 2FA (TOTP)',      status: 'Pending setup', ok: false },
                { label: 'Nathan 2FA (TOTP)',      status: 'Pending setup', ok: false },
                { label: 'Service Role Key',       status: 'Secured',    ok: true },
                { label: 'Trigger hardening',      status: 'Fixed',      ok: true },
                { label: 'Domain email (Resend)',   status: 'DNS needed', ok: false },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span className="text-xs font-semibold" style={{ color: item.ok ? '#22C55E' : '#EAB308' }}>{item.status}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Enrol 2FA</p>
              <Link href="/settings/mfa" className="block w-full text-center text-xs font-bold py-2 rounded-xl transition-all" style={{ background: 'var(--brand-orange)', color: '#07070A' }}>
                Set Up Authenticator →
              </Link>
            </div>
          </div>
        </div>

        {/* ── APK Waitlist ─────────────────────────────────────────────── */}
        {s.waitlist.length > 0 && (
          <div className="p-5 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
            <p className="font-display font-bold text-sm mb-1">APK Beta Waitlist</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{s.waitlist.length} people waiting for the Android app</p>
            <div className="flex flex-wrap gap-2">
              {s.waitlist.slice(0,10).map((w, i) => (
                <span key={w.id} className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)', color: 'var(--text-secondary)' }}>
                  #{i+1} — {timeAgo(w.created_at)}
                </span>
              ))}
              {s.waitlist.length > 10 && <span className="text-xs px-3 py-1 rounded-full" style={{ color: 'var(--text-muted)' }}>+{s.waitlist.length - 10} more</span>}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-6 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Synapse OS Sovereign Command · Only accessible by Ebrine Tushabe &amp; Nathan David ·{' '}
            <Link href="/" style={{ color: 'var(--brand-orange)' }}>Back to site →</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
