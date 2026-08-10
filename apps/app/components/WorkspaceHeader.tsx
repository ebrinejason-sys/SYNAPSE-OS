import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Badge } from '@/components/ui/Badge'
import { SynapseLogo } from '@/components/SynapseLogo'
import { formatRole } from '@/lib/roles'
import { spacing, typography, useTheme } from '@/lib/theme'
import type { MobileUser } from '@/lib/auth'

interface WorkspaceHeaderProps {
  user: MobileUser | null
  subtitle?: string
  showLogo?: boolean
}

/** Top-of-screen workspace context — facility + role badge */
export function WorkspaceHeader({ user, subtitle, showLogo = false }: WorkspaceHeaderProps) {
  const { colors } = useTheme()
  const workspaceLabel = user?.tenantName
    ? user.tenantName
    : user?.role === 'platform_admin'
      ? 'Platform Console'
      : user?.role === 'patient'
        ? 'Personal Health'
        : 'Synapse Workspace'

  return (
    <View style={styles.wrap}>
      {showLogo ? (
        <View style={styles.logoRow}>
          <SynapseLogo size="sm" />
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={styles.copy}>
          <View style={styles.workspaceRow}>
            <Ionicons name="layers-outline" size={14} color={colors.teal} />
            <Text style={[styles.workspace, { color: colors.text }]} numberOfLines={1}>
              {workspaceLabel}
            </Text>
          </View>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
          {user?.synapseId ? (
            <Text style={[styles.synapseId, { color: colors.textMuted }]}>ID {user.synapseId}</Text>
          ) : null}
        </View>
        {user?.role ? <Badge label={formatRole(user.role)} tone="gold" /> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  logoRow: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  copy: { flex: 1 },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workspace: {
    ...typography.bodySm,
    fontFamily: 'DMSans_500Medium',
    flex: 1,
  },
  subtitle: {
    ...typography.caption,
    fontFamily: 'DMSans_400Regular',
    marginTop: spacing.xs,
  },
  synapseId: {
    ...typography.mono,
    fontSize: 11,
    marginTop: spacing.xs,
  },
})
