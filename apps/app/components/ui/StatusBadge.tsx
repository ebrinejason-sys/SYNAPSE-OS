import { StyleSheet, Text, View } from 'react-native'
import { colors, radii } from '@/lib/theme'

const STATUS_MAP: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: 'Waiting', bg: colors.warningSoft, fg: colors.warning },
  in_progress: { label: 'In Progress', bg: colors.infoSoft, fg: colors.info },
  completed: { label: 'Completed', bg: colors.successSoft, fg: colors.success },
  signed: { label: 'Signed', bg: colors.successSoft, fg: colors.success },
  pending: { label: 'Pending', bg: colors.infoSoft, fg: colors.info },
  confirmed: { label: 'Confirmed', bg: colors.successSoft, fg: colors.success },
  cancelled: { label: 'Cancelled', bg: colors.dangerSoft, fg: colors.danger },
  scheduled: { label: 'Scheduled', bg: colors.tealSoft, fg: colors.teal },
}

interface StatusBadgeProps {
  status: string
}

/** Clinical status pill — color + label per blueprint §6 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const key = status.toLowerCase().replace(/\s+/g, '_')
  const mapped = STATUS_MAP[key] ?? {
    label: status.replace(/_/g, ' '),
    bg: 'rgba(161, 161, 172, 0.12)',
    fg: colors.textMuted,
  }

  return (
    <View style={[styles.badge, { backgroundColor: mapped.bg }]}>
      <Text style={[styles.text, { color: mapped.fg }]}>{mapped.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'DMSans_500Medium',
    textTransform: 'capitalize',
  },
})
