'use client'
import type { HealthIntegration } from '../lib/integrations'

interface Props {
  integration: HealthIntegration
  connected?: boolean
  onConnect?: () => void
  onSync?: () => void
}

export function IntegrationCard({ integration, connected = false, onConnect, onSync }: Props) {
  const { name, icon, metrics, available, comingSoon, alwaysActive } = integration

  return (
    <div className="p-4 rounded-xl flex items-start gap-4"
         style={{ background: 'var(--bg-surface)', border: `1px solid ${connected ? 'var(--border-orange)' : 'var(--border-edge)'}` }}>
      <div className="text-2xl flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{name}</span>
          {alwaysActive && (
            <span className="badge-gold text-xs">Always on</span>
          )}
          {connected && !alwaysActive && (
            <span className="badge-orange text-xs">Connected</span>
          )}
          {!available && comingSoon && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(232,184,75,0.12)', color: 'var(--brand-gold)', border: '1px solid var(--border-gold)' }}>
              Soon
            </span>
          )}
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          {comingSoon ?? metrics.map(m => m.replace(/_/g, ' ')).join(', ')}
        </p>
        {available && !alwaysActive && (
          connected ? (
            <button onClick={onSync}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--brand-orange)', border: '1px solid var(--border-orange)' }}>
              Sync now
            </button>
          ) : (
            <button onClick={onConnect}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all btn-primary">
              Connect
            </button>
          )
        )}
      </div>
    </div>
  )
}
