'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

export const THEME_STORAGE_KEY = 'synapse-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      themes={['light', 'dark']}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  )
}
