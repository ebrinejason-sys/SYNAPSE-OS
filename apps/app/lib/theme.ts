/** Synapse mobile design tokens — clinical dark theme with copper + gold accents. */
export const colors = {
  bg: '#050508',
  bgElevated: '#0C0C12',
  surface: '#111118',
  surfaceHover: '#16161F',
  border: '#252530',
  borderSubtle: '#1A1A22',
  text: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  primary: '#F97316',
  primarySoft: 'rgba(249, 115, 22, 0.12)',
  gold: '#E8B84B',
  goldSoft: 'rgba(232, 184, 75, 0.14)',
  teal: '#14B8A6',
  tealSoft: 'rgba(20, 184, 166, 0.12)',
  success: '#22C55E',
  error: '#F87171',
  errorBg: 'rgba(239, 68, 68, 0.08)',
  errorBorder: 'rgba(239, 68, 68, 0.28)',
  white: '#FFFFFF',
} as const

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 999,
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const typography = {
  hero: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  stat: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.5 },
} as const

export const tabBarHeight = 60
