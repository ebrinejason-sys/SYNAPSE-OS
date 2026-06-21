import { StyleSheet, Text, View } from 'react-native'
import { colors, radii } from '@/lib/theme'

interface BadgeProps {
  label: string
  tone?: 'gold' | 'primary' | 'teal'
}

export function Badge({ label, tone = 'gold' }: BadgeProps) {
  const toneStyle =
    tone === 'primary' ? styles.primary : tone === 'teal' ? styles.teal : styles.gold

  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={[styles.text, tone === 'gold' && styles.goldText]} numberOfLines={1}>
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
  gold: {
    backgroundColor: colors.goldSoft,
    borderColor: 'rgba(232, 184, 75, 0.35)',
  },
  primary: {
    backgroundColor: colors.primarySoft,
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  teal: {
    backgroundColor: colors.tealSoft,
    borderColor: 'rgba(20, 184, 166, 0.35)',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  goldText: { color: colors.gold },
})
