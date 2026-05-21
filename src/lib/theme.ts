// Synapse Dark Theme (Adapted from grow.crl.to)
export const theme = {
  colors: {
    background: '#0a0a0a',
    card: '#121212',
    primary: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4', // Synapse Primary Cyan
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
    },
    accent: '#22d3ee',
    emerald: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },
  },
  typography: {
    fontFamily: {
      sans: "'Inter', 'system-ui', sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
  },
};

export type Theme = typeof theme;
