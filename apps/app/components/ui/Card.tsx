import { ReactNode } from 'react'
import { StyleSheet, Text, TextStyle, View, ViewStyle, StyleProp } from 'react-native'
import { radii, spacing, typography, useTheme } from '@/lib/theme'

interface CardProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  padded?: boolean
}

export function Card({ children, style, padded = true }: CardProps) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function SectionHeader({ title, style }: { title: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme()
  return <Text style={[styles.section, { color: colors.textSecondary }, style]}>{title}</Text>
}

export function Divider() {
  const { colors } = useTheme()
  return <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
  section: {
    ...typography.label,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.lg,
  },
})
