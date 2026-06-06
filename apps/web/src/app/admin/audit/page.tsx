'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { createClient } from '../../../lib/supabase/client'

interface AuditLog {
  id: string
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown> | null
  created_at: string | null
  actor_name?: string
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data: profile } = await sb.from('profiles').select('hospital_id').eq('id', user.id).single() as { data: { hospital_id: string } | null }
      if (!profile?.hospital_id) { setLoading(false); return }
      const { data } = await sb.from('audit_logs')
        .select('id, user_id, action, resource_type, resource_id, details, created_at, profiles(full_name)')
        .eq('hospital_id', profile.hospital_id)
        .order('created_at', { ascending: false })
        .limit(200) as { data: (AuditLog & { profiles?: { full_name: string } })[] | null }
      setLogs((data ?? []).map(l => ({ ...l, actor_name: l.profiles?.full_name })))
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Audit Log</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>All staff actions recorded for compliance</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand-orange)' }}>
          <Shield className="h-5 w-5" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading audit logs…</div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No audit logs yet.</div>
      ) : (
        <div className="space-y-1">
          {logs.map(log => (
            <div key={log.id}
              className="flex items-start gap-3 rounded-xl px-4 py-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-edge)' }}>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0 mt-0.5"
                style={{ background: 'rgba(249,115,22,0.08)', color: 'var(--brand-orange)' }}>
                <Shield className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {log.actor_name ?? log.user_id?.slice(0, 8) ?? 'System'}
                  </span>
                  <span className="text-xs rounded-full px-2 py-0.5"
                    style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>
                    {log.action}
                  </span>
                  {log.resource_type && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      on {log.resource_type}
                    </span>
                  )}
                </div>
                {log.details && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {JSON.stringify(log.details)}
                  </p>
                )}
              </div>
              <p className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                {log.created_at ? new Date(log.created_at).toLocaleString('en-UG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
