/**
 * Synapse mobile design tokens — aligned with blueprint 03_DESIGN_SYSTEM.md.
 * Dark mode default; semantic tokens only (no raw hex in components).
 */
export const colors = {
  // Surfaces (dark default)
  bg: '#07070A',
  bgSubtle: '#0E0E12',
  bgElevated: '#16161B',
  surface: '#16161B',
  surfaceHover: '#26262C',
  popover: '#26262C',

  // Text
  text: '#ECECEF',
  textSecondary: '#A1A1AC',
  textMuted: '#71717A',

  // Lines
  border: '#26262C',
  borderStrong: '#3A3A44',
  borderSubtle: '#1A1A22',
  input: '#3A3A44',

  // Brand
  primary: '#F97316',
  primaryHover: '#FB7E3C',
  primaryForeground: '#07070A',
  primarySoft: 'rgba(249, 115, 22, 0.12)',
  accent: '#FB7E3C',
  gold: '#E8B84B',
  goldSoft: 'rgba(232, 184, 75, 0.12)',
  teal: '#1FA6A6',
  tealSoft: 'rgba(31, 166, 166, 0.12)',

  // Status (clinical-safe, distinct from brand orange)
  success: '#3DD68C',
  successSoft: 'rgba(61, 214, 140, 0.12)',
  warning: '#FFB224',
  warningSoft: 'rgba(255, 178, 36, 0.12)',
  danger: '#F2555A',
  dangerSoft: 'rgba(242, 85, 90, 0.12)',
  info: '#4C9DFF',
  infoSoft: 'rgba(76, 157, 255, 0.12)',

  // Legacy aliases used by some components
  error: '#F2555A',
  errorBg: 'rgba(242, 85, 90, 0.08)',
  errorBorder: 'rgba(242, 85, 90, 0.28)',
  white: '#FFFFFF',

  // Mono surfaces
  codeBg: '#0E0E12',
  codeFg: '#D2D2D9',
} as const

/** 8pt grid — blueprint spacing scale */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  // Aliases for readability
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

/** Fixed radius scale — blueprint §4 */
export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const

/**
 * Shared Synapse type system (matches apps/web + apps/pharmacy and the brief):
 * Bricolage Grotesque for display/headings, DM Sans for body, IBM Plex Mono for
 * data. Loaded in app/_layout.tsx via @expo-google-fonts.
 */
export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  heading: 'BricolageGrotesque_600SemiBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  mono: 'IBMPlexMono_500Medium',
} as const

export const typography = {
  display: { fontFamily: fonts.display, fontSize: 36, fontWeight: '600' as const, letterSpacing: -0.4, lineHeight: 43 },
  h1: { fontFamily: fonts.display, fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.3, lineHeight: 34 },
  h2: { fontFamily: fonts.heading, fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.2, lineHeight: 28 },
  h3: { fontFamily: fonts.heading, fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  h4: { fontFamily: fonts.heading, fontSize: 15, fontWeight: '600' as const, lineHeight: 21 },
  bodyLg: { fontFamily: fonts.body, fontSize: 18, fontWeight: '400' as const, lineHeight: 29 },
  body: { fontFamily: fonts.body, fontSize: 16, fontWeight: '400' as const, lineHeight: 26 },
  bodySm: { fontFamily: fonts.body, fontSize: 14, fontWeight: '400' as const, lineHeight: 21 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.12, lineHeight: 17 },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  mono: { fontFamily: fonts.mono, fontSize: 14, fontWeight: '500' as const, lineHeight: 21 },
  stat: { fontFamily: fonts.display, fontSize: 24, fontWeight: '600' as const, letterSpacing: -0.5, lineHeight: 29 },
  // Legacy aliases
  hero: { fontFamily: fonts.display, fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.3 },
  title: { fontFamily: fonts.heading, fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.heading, fontSize: 17, fontWeight: '600' as const },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '500' as const },
} as const

export const tabBarHeight = 56

export const TONE_COLORS = {
  primary: colors.primary,
  gold: colors.gold,
  green: colors.success,
  red: colors.danger,
  muted: colors.textMuted,
  teal: colors.teal,
  warning: colors.warning,
  info: colors.info,
} as const

export type StatTone = keyof typeof TONE_COLORS
