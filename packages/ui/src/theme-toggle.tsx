'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState, type ReactNode } from 'react'

type ThemeChoice = 'light' | 'dark' | 'system'

type SynapseThemeToggleProps = {
  className?: string
  size?: 'sm' | 'md'
  /** icon = compact cycle button; segmented = explicit Light / Auto / Dark */
  variant?: 'icon' | 'segmented'
}

function MonitorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function SynapseThemeToggle({
  className = '',
  size = 'md',
  variant = 'icon',
}: SynapseThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const dimension = size === 'sm' ? '2rem' : '2.25rem'
  const active = (theme ?? 'system') as ThemeChoice

  if (!mounted) {
    if (variant === 'segmented') {
      return (
        <span
          className={`inline-flex h-8 w-[7.5rem] rounded-lg border border-border bg-muted ${className}`}
          aria-hidden
        />
      )
    }
    return (
      <span
        className={`inline-block rounded-xl border border-border bg-muted ${className}`}
        style={{ width: dimension, height: dimension }}
        aria-hidden
      />
    )
  }

  if (variant === 'segmented') {
    const options: { value: ThemeChoice; label: string; icon: ReactNode }[] = [
      { value: 'light', label: 'Light', icon: <SunIcon /> },
      { value: 'system', label: 'Auto', icon: <MonitorIcon /> },
      { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
    ]
    return (
      <div
        role="group"
        aria-label="Color theme"
        className={`inline-flex items-center rounded-lg border border-border bg-muted p-0.5 ${className}`}
      >
        {options.map((opt) => {
          const selected = active === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-label={`${opt.label} theme`}
              aria-pressed={selected}
              title={opt.label}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                selected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.icon}
            </button>
          )
        })}
      </div>
    )
  }

  function cycle() {
    const order: ThemeChoice[] = ['system', 'light', 'dark']
    const idx = order.indexOf(active)
    const next = order[(idx + 1) % order.length] ?? 'system'
    setTheme(next)
  }

  const label =
    active === 'system'
      ? `System theme (${resolvedTheme})`
      : active === 'dark'
        ? 'Switch to system theme'
        : 'Switch to dark mode'

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={`relative flex shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      {active === 'system' ? (
        <MonitorIcon />
      ) : resolvedTheme === 'dark' ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  )
}
