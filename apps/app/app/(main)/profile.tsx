import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, Divider } from '@/components/ui/Card'
import { WorkspaceHeader } from '@/components/WorkspaceHeader'
import { useAuth } from '@/lib/auth'
import { dashboardKindForRole, formatRole } from '@/lib/roles'
import { colors, spacing, tabBarHeight, typography } from '@/lib/theme'

const WEB_APP_URL = (
  (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ?? 'https://www.synapseos.tech'
).replace(/\/$/, '')

export default function ProfileScreen() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const initial = (user?.fullName ?? user?.email ?? '?')[0]?.toUpperCase() ?? '?'
  const kind = dashboardKindForRole(user?.role)

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const openWebPortal = () => {
    if (kind === 'pharmacy') {
      Linking.openURL('https://pharm.synapseos.tech/portal/billing').catch(() => {})
      return
    }
    const path =
      kind === 'patient'
        ? '/health/dashboard'
        : user?.role === 'platform_admin'
          ? '/platform'
          : '/login'
    Linking.openURL(`${WEB_APP_URL}${path}`).catch(() => {})
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        padding: spacing.xl,
        paddingBottom: insets.bottom + tabBarHeight + spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <WorkspaceHeader user={user} subtitle="Account & workspace" />

      <View style={styles.profileRow}>
        <Avatar label={initial} size={64} />
        <View style={styles.profileCopy}>
          <Text style={styles.name}>{user?.fullName ?? 'Unknown user'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      <Card padded={false}>
        <InfoRow label="Role" value={formatRole(user?.role ?? '')} />
        <Divider />
        <InfoRow label="Workspace" value={user?.tenantName || (kind === 'patient' ? 'Personal Health' : '—')} />
        <Divider />
        <InfoRow label="Synapse ID" value={user?.synapseId ?? '—'} mono />
        <Divider />
        <InfoRow
          label="Account"
          value={user?.isAdmin ? 'Administrator' : kind === 'patient' ? 'Personal' : 'Staff'}
        />
      </Card>

      <View style={styles.actions}>
        <Button
          label={kind === 'pharmacy' ? 'Billing & renewal' : 'Open web portal'}
          onPress={openWebPortal}
          variant="ghost"
        />
      </View>

      <Button label="Sign out" onPress={handleLogout} variant="danger" style={styles.logoutBtn} />

      <View style={styles.footer}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
        <Text style={styles.version}>Synapse Health Technologies · Secure session</Text>
      </View>
    </ScrollView>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, mono && styles.monoValue]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  profileCopy: { flex: 1 },
  name: {
    ...typography.h2,
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
  },
  email: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontFamily: 'DMSans_400Regular',
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontFamily: 'DMSans_400Regular',
  },
  rowValue: {
    ...typography.bodyMedium,
    color: colors.text,
    fontFamily: 'DMSans_500Medium',
    textAlign: 'right',
    flex: 1,
  },
  monoValue: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
  actions: { marginTop: spacing.xxl },
  logoutBtn: { marginTop: spacing.lg },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xxl,
  },
  version: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
  },
})
