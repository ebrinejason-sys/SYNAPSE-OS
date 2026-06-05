import Image from 'next/image'
import React from 'react'

interface Props {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon' | 'wordmark'
  className?: string
}

const ICON_PX = { xs: 20, sm: 28, md: 36, lg: 48, xl: 64 }
const TEXT_CLS = { xs: 'text-sm', sm: 'text-base', md: 'text-xl', lg: 'text-2xl', xl: 'text-3xl' }

export function SynapseLogo({ size = 'md', variant = 'full', className = '' }: Props) {
  const px = ICON_PX[size]

  const Icon = () => (
    <Image
      src="/synapse-logo.jpg"
      alt="Synapse OS logo"
      width={px}
      height={px}
      style={{ borderRadius: Math.round(px * 0.22), display: 'block', flexShrink: 0 }}
      priority
    />
  )

  if (variant === 'icon') return <Icon />

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
      <Icon />
      <span className={`font-display font-bold tracking-tight ${TEXT_CLS[size]}`}>
        <span style={{ color: '#F97316' }}>Synapse</span>
        <span style={{ color: '#E8B84B' }}>OS</span>
      </span>
    </div>
  )
}

export default SynapseLogo
