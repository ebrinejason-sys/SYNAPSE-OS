import { StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '@/lib/theme'

interface EmptyStateProps {
  title: string
  body: string
  icon?: string
}

export function EmptyState({ title, body, icon = '◌' }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconRing}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: spacing.xxxl * 2,
    paddingHorizontal: spacing.xxl,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 22,
    color: colors.teal,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
})
