import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/lib/auth'

export default function SettingsScreen() {
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout()
            router.replace('/(auth)/login')
          },
        },
      ]
    )
  }

  const initial = (user?.fullName ?? user?.email ?? '?')[0]?.toUpperCase() ?? '?'

  return (
    <View style={styles.container}>
      {/* Profile header */}
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.fullName ?? 'Unknown User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <InfoRow label="Role" value={formatRole(user?.role ?? '')} />
        <Divider />
        <InfoRow label="Facility" value={user?.tenantName ?? '—'} />
        <Divider />
        <InfoRow label="Account type" value={user?.isAdmin ? 'Administrator' : 'Staff'} />
      </View>

      <View style={{ flex: 1 }} />

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Synapse Health Technologies</Text>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#1C1C24', marginHorizontal: 16 }} />
}

function formatRole(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070A', padding: 20 },

  profileRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, marginTop: 8, marginBottom: 28,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#F97316',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  name: { color: '#fff', fontSize: 17, fontWeight: '700' },
  email: { color: '#71717A', fontSize: 13, marginTop: 3 },

  card: {
    backgroundColor: '#111117', borderRadius: 16,
    borderWidth: 1, borderColor: '#27272A', overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  rowLabel: { color: '#A1A1AA', fontSize: 14 },
  rowValue: { color: '#fff', fontSize: 14, fontWeight: '600' },

  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  logoutText: { color: '#F87171', fontSize: 15, fontWeight: '700' },

  version: {
    textAlign: 'center', color: '#27272A', fontSize: 11, marginBottom: 8,
  },
})
