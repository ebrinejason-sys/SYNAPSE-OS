import React from 'react'

interface Props {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon' | 'wordmark'
  className?: string
}

const SIZES = { xs: 20, sm: 28, md: 36, lg: 48, xl: 64 }
const TEXT  = { xs: 'text-sm', sm: 'text-base', md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl' }

export function SynapseLogo({ size = 'md', variant = 'full', className = '' }: Props) {
  const s = SIZES[size]

  const Icon = () => (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="19" stroke="#F97316" strokeWidth="1.5" fill="rgba(249,115,22,0.08)" />
      <circle cx="20" cy="20" r="4"   fill="#F97316" />
      <circle cx="20" cy="8"  r="2.5" fill="#E8B84B" />
      <circle cx="20" cy="32" r="2.5" fill="#E8B84B" />
      <circle cx="8"  cy="20" r="2.5" fill="#E8B84B" />
      <circle cx="32" cy="20" r="2.5" fill="#E8B84B" />
      <circle cx="11" cy="11" r="2"   fill="#FB923C" opacity="0.8" />
      <circle cx="29" cy="11" r="2"   fill="#FB923C" opacity="0.8" />
      <circle cx="11" cy="29" r="2"   fill="#FB923C" opacity="0.8" />
      <circle cx="29" cy="29" r="2"   fill="#FB923C" opacity="0.8" />
      <line x1="20" y1="16"  x2="20" y2="10.5" stroke="#F97316" strokeWidth="1"   strokeOpacity="0.6" />
      <line x1="20" y1="24"  x2="20" y2="29.5" stroke="#F97316" strokeWidth="1"   strokeOpacity="0.6" />
      <line x1="16" y1="20"  x2="10.5" y2="20" stroke="#F97316" strokeWidth="1"   strokeOpacity="0.6" />
      <line x1="24" y1="20"  x2="29.5" y2="20" stroke="#F97316" strokeWidth="1"   strokeOpacity="0.6" />
      <line x1="17.2" y1="17.2" x2="12.8" y2="12.8" stroke="#E8B84B" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="22.8" y1="17.2" x2="27.2" y2="12.8" stroke="#E8B84B" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="17.2" y1="22.8" x2="12.8" y2="27.2" stroke="#E8B84B" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="22.8" y1="22.8" x2="27.2" y2="27.2" stroke="#E8B84B" strokeWidth="0.8" strokeOpacity="0.5" />
    </svg>
  )

  if (variant === 'icon') return <Icon />

  if (variant === 'wordmark') {
    return (
      <span className={`font-display font-bold tracking-tight ${TEXT[size]} ${className}`}>
        <span style={{ color: '#F97316' }}>Synapse</span>
        <span style={{ color: '#E8B84B' }}>OS</span>
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Icon />
      <span className={`font-display font-bold tracking-tight ${TEXT[size]}`}>
        <span style={{ color: '#F97316' }}>Synapse</span>
        <span style={{ color: '#E8B84B' }}>OS</span>
      </span>
    </div>
  )
}

export default SynapseLogo
