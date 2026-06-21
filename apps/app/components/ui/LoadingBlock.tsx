import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { colors, spacing, typography } from '@/lib/theme'

export function LoadingBlock({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.xxxl * 2,
    alignItems: 'center',
    gap: spacing.lg,
  },
  text: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
})
