import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, Divider } from '@/components/ui/Card'
import { useAuth } from '@/lib/auth'
import { formatRole } from '@/lib/roles'
import { colors, spacing, tabBarHeight, typography } from '@/lib/theme'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const initial = (user?.fullName ?? user?.email ?? '?')[0]?.toUpperCase() ?? '?'

  const handleLogout = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await logout()
            router.replace('/(auth)/login')
          },
        },
      ]
    )
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
        <InfoRow label="Facility" value={user?.tenantName ?? '—'} />
        <Divider />
        <InfoRow label="Account type" value={user?.isAdmin ? 'Administrator' : 'Staff'} />
      </Card>

      <Button
        label="Sign out"
        onPress={handleLogout}
        variant="danger"
        style={styles.logoutBtn}
      />

      <Text style={styles.version}>Synapse Health Technologies</Text>
    </ScrollView>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
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
    marginTop: spacing.sm,
  },
  profileCopy: { flex: 1 },
  name: {
    ...typography.heading,
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
  },
  email: {
    ...typography.caption,
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
  logoutBtn: { marginTop: spacing.xxxl },
  version: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
    marginTop: spacing.xxl,
  },
})
