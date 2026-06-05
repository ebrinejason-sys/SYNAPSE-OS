'use client'
import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('synapse-theme') as Theme | null
    const preferred = window.matchMedia('(prefers-color-scheme:light)').matches ? 'light' : 'dark'
    const t = stored || preferred
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('synapse-theme', next)
  }

  return { theme, toggle, isDark: theme === 'dark' }
}
