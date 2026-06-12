import { StyleSheet, Text, View } from 'react-native'
import { useAuth } from '@/lib/auth'

export default function HomeScreen() {
  const { user } = useAuth()

  return (
    <View style={styles.container}>
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          Good {timeOfDay()},{' '}
          <Text style={styles.greetingName}>
            {user?.fullName?.split(' ')[0] ?? 'Doctor'}
          </Text>
        </Text>
        <RoleBadge role={user?.role ?? ''} />
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Waiting" value="—" color="#F97316" />
        <StatCard label="In Progress" value="—" color="#E8B84B" />
        <StatCard label="Completed" value="—" color="#22C55E" />
      </View>

      <Text style={styles.sectionTitle}>Today's Queue</Text>

      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🏥</Text>
        <Text style={styles.emptyTitle}>No patients yet</Text>
        <Text style={styles.emptyFacility}>{user?.tenantName}</Text>
      </View>
    </View>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
      </Text>
    </View>
  )
}

function timeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07070A', padding: 20 },

  greeting: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  greetingText: { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1 },
  greetingName: { color: '#F97316' },
  badge: {
    backgroundColor: '#18181B', borderRadius: 8,
    borderWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { color: '#71717A', fontSize: 11, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: {
    flex: 1, backgroundColor: '#111117', borderRadius: 14,
    borderWidth: 1, borderColor: '#27272A', padding: 14, alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#71717A', fontSize: 11, marginTop: 4, fontWeight: '500' },

  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 16 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { color: '#52525B', fontSize: 15, fontWeight: '600' },
  emptyFacility: { color: '#3F3F46', fontSize: 12, marginTop: 6 },
})
