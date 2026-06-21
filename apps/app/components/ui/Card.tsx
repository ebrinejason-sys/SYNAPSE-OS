import { ReactNode } from 'react'
import { StyleSheet, Text, TextStyle, View, ViewStyle, StyleProp } from 'react-native'
import { colors, radii, spacing, typography } from '@/lib/theme'

interface CardProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  padded?: boolean
}

export function Card({ children, style, padded = true }: CardProps) {
  return (
    <View style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  )
}

export function SectionHeader({ title, style }: { title: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.section, style]}>{title}</Text>
}

export function Divider() {
  return <View style={styles.divider} />
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
  section: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: spacing.lg,
  },
})
