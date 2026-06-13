import { useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { apiRequest } from '@/lib/api'

interface QueueEntry {
  encounterId: string
  status: string
  chiefComplaint: string | null
  clinicalStage: string | null
  createdAt: string
  patient: {
    id: string
    fullName: string
    mrn: string | null
    dateOfBirth: string | null
    sex: string | null
  } | null
}

interface QueueStats {
  waiting: number
  inProgress: number
  completed: number
}

const STATUS_COLORS: Record<string, string> = {
  open: '#F97316',
  in_progress: '#E8B84B',
  completed: '#22C55E',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Waiting',
  in_progress: 'In Progress',
  completed: 'Done',
}

export default function HomeScreen() {
  const { user, token } = useAuth()
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [stats, setStats] = useState<QueueStats>({ waiting: 0, inProgress: 0, completed: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadQueue() {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const data = await apiRequest<{ queue: QueueEntry[]; stats: QueueStats }>(
        '/api/mobile/queue',
        { token }
      )
      setQueue(data.queue)
      setStats(data.stats)
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadQueue() }, [token])

  const onRefresh = () => {
    setRefreshing(true)
    loadQueue()
  }

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
        <StatCard label="Waiting" value={String(stats.waiting)} color="#F97316" />
        <StatCard label="In Progress" value={String(stats.inProgress)} color="#E8B84B" />
        <StatCard label="Completed" value={String(stats.completed)} color="#22C55E" />
      </View>

      <Text style={styles.sectionTitle}>Today's Queue</Text>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={item => item.encounterId}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#F97316"
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏥</Text>
              <Text style={styles.emptyTitle}>No patients in queue</Text>
              <Text style={styles.emptyFacility}>{user?.tenantName}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>{item.patient?.fullName ?? 'Unknown'}</Text>
                  {item.patient?.mrn ? (
                    <Text style={styles.mrn}>MRN {item.patient.mrn}</Text>
                  ) : null}
                </View>
                <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[item.status] ?? '#52525B' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? '#52525B' }]}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              {item.chiefComplaint ? (
                <Text style={styles.complaint} numberOfLines={2}>{item.chiefComplaint}</Text>
              ) : null}
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>
          )}
        />
      )}
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

  separator: { height: 10 },

  card: {
    backgroundColor: '#111117', borderRadius: 14,
    borderWidth: 1, borderColor: '#27272A', padding: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  patientName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  mrn: { color: '#52525B', fontSize: 11, marginTop: 2 },
  statusBadge: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  complaint: { color: '#A1A1AA', fontSize: 13, marginBottom: 8 },
  time: { color: '#52525B', fontSize: 11 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60, paddingTop: 40 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { color: '#52525B', fontSize: 15, fontWeight: '600' },
  emptyFacility: { color: '#3F3F46', fontSize: 12, marginTop: 6 },
})
