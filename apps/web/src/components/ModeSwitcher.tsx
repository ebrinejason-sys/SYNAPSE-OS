'use client'
import { Stethoscope, User } from 'lucide-react'
import { useIdentity } from '../hooks/useIdentity'

export function ModeSwitcher() {
  const identity = useIdentity()
  if (!identity || identity === 'loading' || !identity.hasBothModes) return null

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl"
         style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-edge)' }}>
      <button
        onClick={() => identity.switchMode('staff')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          identity.activeMode === 'staff' ? 'bg-orange-500 text-white' : ''
        }`}
        style={identity.activeMode !== 'staff' ? { color: 'var(--text-secondary)' } : undefined}
      >
        <Stethoscope size={12} /> Hospital
      </button>
      <button
        onClick={() => identity.switchMode('patient')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          identity.activeMode === 'patient' ? 'btn-gold' : ''
        }`}
        style={identity.activeMode !== 'patient' ? { color: 'var(--text-secondary)' } : undefined}
      >
        <User size={12} /> Personal
      </button>
    </div>
  )
}
