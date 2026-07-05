import type { ReactNode } from 'react'
import { Reveal } from './Reveal'

type SectionShellProps = {
  id?: string
  label?: string
  title: string
  description?: string
  variant?: 'default' | 'surface' | 'warm' | 'cool'
  /** Reduced block padding for secondary/detail sections, so the primary
   * journey (hero, products, features, modules, pricing, demo, compare)
   * keeps its full spacing while supporting sections take up less room. */
  tight?: boolean
  className?: string
  children: ReactNode
}

const VARIANT_CLASS: Record<NonNullable<SectionShellProps['variant']>, string> = {
  default: '',
  surface: 'landing-section-surface',
  warm: 'landing-section-warm',
  cool: 'landing-section-cool',
}

export function SectionShell({
  id,
  label,
  title,
  description,
  variant = 'default',
  tight = false,
  className = '',
  children,
}: SectionShellProps) {
  return (
    <section
      id={id}
      className={`landing-section ${VARIANT_CLASS[variant]} ${tight ? 'landing-section-tight' : ''} ${className}`}
    >
      <div className="landing-container">
        <Reveal>
          {label && <p className="section-label">{label}</p>}
          <h2 className="landing-heading mb-3">{title}</h2>
          {description && (
            <p className="landing-lead mb-10 max-w-2xl">{description}</p>
          )}
        </Reveal>
        <Reveal delay={0.08}>{children}</Reveal>
      </div>
    </section>
  )
}
