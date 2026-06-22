import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radii, spacing, typography } from '@/lib/theme'

type EmptyIcon = 'inbox' | 'search' | 'calendar' | 'medkit' | 'document' | 'cube' | 'checkmark-circle'

interface EmptyStateProps {
  title: string
  body: string
  icon?: EmptyIcon
}

const ICON_MAP: Record<EmptyIcon, keyof typeof Ionicons.glyphMap> = {
  inbox: 'file-tray-outline',
  search: 'search-outline',
  calendar: 'calendar-outline',
  medkit: 'medkit-outline',
  document: 'document-text-outline',
  cube: 'cube-outline',
  'checkmark-circle': 'checkmark-circle-outline',
}

export function EmptyState({ title, body, icon = 'inbox' }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconRing}>
        <Ionicons name={ICON_MAP[icon]} size={24} color={colors.teal} />
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
  title: {
    ...typography.h3,
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
})
