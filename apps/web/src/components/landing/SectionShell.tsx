import type { ReactNode } from 'react'

type SectionShellProps = {
  id?: string
  label?: string
  title: string
  description?: string
  variant?: 'default' | 'surface'
  className?: string
  children: ReactNode
}

export function SectionShell({
  id,
  label,
  title,
  description,
  variant = 'default',
  className = '',
  children,
}: SectionShellProps) {
  return (
    <section
      id={id}
      className={`landing-section ${variant === 'surface' ? 'landing-section-surface' : ''} ${className}`}
    >
      <div className="landing-container">
        {label && <p className="section-label">{label}</p>}
        <h2 className="landing-heading mb-3">{title}</h2>
        {description && (
          <p className="landing-lead mb-10 max-w-2xl">{description}</p>
        )}
        {children}
      </div>
    </section>
  )
}
