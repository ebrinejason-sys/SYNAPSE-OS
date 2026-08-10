import { StyleSheet, Text, View } from 'react-native'
import { radii, useTheme } from '@/lib/theme'

interface BadgeProps {
  label: string
  tone?: 'gold' | 'primary' | 'teal'
}

export function Badge({ label, tone = 'gold' }: BadgeProps) {
  const { colors } = useTheme()
  const toneStyle =
    tone === 'primary'
      ? { backgroundColor: colors.primarySoft, borderColor: 'rgba(249, 115, 22, 0.35)' }
      : tone === 'teal'
        ? { backgroundColor: colors.tealSoft, borderColor: 'rgba(20, 184, 166, 0.35)' }
        : { backgroundColor: colors.goldSoft, borderColor: 'rgba(232, 184, 75, 0.35)' }

  return (
    <View style={[styles.badge, toneStyle]}>
      <Text
        style={[styles.text, { color: tone === 'gold' ? colors.gold : colors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '46%',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
})
