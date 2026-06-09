import React from 'react'

interface Props {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon' | 'wordmark'
  className?: string
}

const ICON_PX  = { xs: 20, sm: 28, md: 36, lg: 48, xl: 64 }
const TEXT_CLS = { xs: 'text-sm', sm: 'text-base', md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl' }

export function SynapseLogo({ size = 'md', variant = 'full', className = '' }: Props) {
  const px = ICON_PX[size]

  const logoImg = (
    <span
      aria-label="Synapse OS"
      role="img"
      style={{
        width: px,
        height: px,
        borderRadius: Math.round(px * 0.22),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(232,184,75,0.12))',
        border: '1px solid rgba(232,184,75,0.35)',
        boxShadow: 'inset 0 0 0 1px rgba(249,115,22,0.12)',
        color: '#F97316',
        fontWeight: 900,
        fontSize: Math.max(11, Math.round(px * 0.45)),
        lineHeight: 1,
      }}
    >
      S
    </span>
  )

  if (variant === 'icon') return logoImg

  if (variant === 'wordmark') {
    return (
      <span className={`font-display font-bold tracking-tight ${TEXT_CLS[size]} ${className}`}>
        <span style={{ color: '#F97316' }}>Synapse</span>
        <span style={{ color: '#E8B84B' }}>OS</span>
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {logoImg}
      <span className={`font-display font-bold tracking-tight ${TEXT_CLS[size]}`}>
        <span style={{ color: '#F97316' }}>Synapse</span>
        <span style={{ color: '#E8B84B' }}>OS</span>
      </span>
    </div>
  )
}

export default SynapseLogo
