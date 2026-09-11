'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'
import { SYNAPSE_THEME_STORAGE_KEY } from '@synapse/config/theme'

export { SYNAPSE_THEME_STORAGE_KEY }

export function SynapseThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      storageKey={SYNAPSE_THEME_STORAGE_KEY}
      themes={['light', 'dark']}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  )
}
