import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Linking, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
import { useAuth } from '@/lib/auth'
import { fetchDashboard, TONE_COLORS, type DashboardResponse, type DashboardQuickAction } from '@/lib/dashboard'
import { dashboardKindForRole, formatRole, type DashboardKind } from '@/lib/roles'

const WEB_APP_URL = (
  (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ?? 'https://synapseos.tech'
).replace(/\/$/, '')

const KIND_SUBTITLE: Record<DashboardKind, string> = {
  patient: 'Your health at a glance',
  clinician: 'Your clinical workspace',
  nurse: 'Care tasks & vitals',
  pharmacy: 'Pharmacy overview',
  lab: 'Laboratory workspace',
  reception: 'Front desk overview',
  billing: 'Claims & billing',
  admin: 'Facility overview',
  generic: 'Your dashboard',
}

export default function DashboardScreen() {
  const { user, token, logout } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const res = await fetchDashboard(token)
      setData(res)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  const handleAction = (action: DashboardQuickAction) => {
    const [scheme, ...rest] = action.target.split(':')
    const path = rest.join(':')
    if (scheme === 'app') {
      router.push(path as never)
    } else {
      Linking.openURL(`${WEB_APP_URL}${path}`).catch(() => {})
    }
  }

  const kind = data?.dashboardKind ?? dashboardKindForRole(user?.role)
  const firstName = user?.fullName?.split(' ')[0] ?? null
  const stats = data?.summary.stats ?? []
  const listSection = data?.summary.list ?? null
  const quickActions = data?.quickActions ?? []

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            Good {timeOfDay()}{firstName ? `, ` : ''}
            {firstName ? <Text style={styles.greetingName}>{firstName}</Text> : null}
          </Text>
          <Text style={styles.subtitle}>{KIND_SUBTITLE[kind]}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{formatRole(user?.role)}</Text>
        </View>
      </View>

      {(data?.tenantName || user?.tenantName) ? (
        <Text style={styles.tenant}>{data?.tenantName || user?.tenantName}</Text>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#F97316" size="large" />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load() }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Stats grid */}
          {stats.length > 0 ? (
            <View style={styles.statsGrid}>
              {stats.map((s) => (
                <View key={s.key} style={styles.statCard}>
                  <Text style={[styles.statValue, { color: TONE_COLORS[s.tone] }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Quick actions */}
          {quickActions.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsWrap}>
                {quickActions.map((a) => (
                  <TouchableOpacity
                    key={a.key}
                    style={styles.actionBtn}
                    activeOpacity={0.8}
                    onPress={() => handleAction(a)}
                  >
                    <Text style={styles.actionText}>{a.label}</Text>
                    <Text style={styles.actionArrow}>
                      {a.target.startsWith('web:') ? '↗' : '›'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {/* List section */}
          {listSection && listSection.items.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{listSection.title}</Text>
              {listSection.items.map((item) => (
                <View key={item.id} style={styles.listCard}>
                  <View
                    style={[
                      styles.listAccent,
                      { backgroundColor: TONE_COLORS[item.tone ?? 'muted'] },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{item.title}</Text>
                    {item.subtitle ? (
                      <Text style={styles.listSubtitle} numberOfLines={2}>{item.subtitle}</Text>
                    ) : null}
                  </View>
                  {item.meta ? (
                    <Text style={[styles.listMeta, { color: TONE_COLORS[item.tone ?? 'muted'] }]}>
                      {formatMeta(item.meta)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : stats.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyTitle}>You&apos;re all set</Text>
              <Text style={styles.emptyBody}>
                Nothing needs your attention right now. Pull down to refresh.
              </Text>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  )
}

function timeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function formatMeta(meta: string) {
  return meta.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07070A' },
  content: { padding: 20, paddingBottom: 48 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  greeting: { color: '#fff', fontSize: 22, fontWeight: '800' },
  greetingName: { color: '#F97316' },
  subtitle: { color: '#71717A', fontSize: 13, marginTop: 4 },
  badge: {
    backgroundColor: '#18181B', borderRadius: 8,
    borderWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  badgeText: { color: '#E8B84B', fontSize: 11, fontWeight: '700' },
  tenant: { color: '#52525B', fontSize: 12, marginTop: 6, fontWeight: '600' },

  center: { paddingVertical: 80, alignItems: 'center' },

  errorBox: {
    marginTop: 32, backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    padding: 20, alignItems: 'center',
  },
  errorText: { color: '#F87171', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: '#18181B', borderRadius: 10,
    borderWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 20, paddingVertical: 9,
  },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 24 },
  statCard: {
    flexGrow: 1, flexBasis: '30%', minWidth: '30%',
    backgroundColor: '#111117', borderRadius: 14,
    borderWidth: 1, borderColor: '#27272A', padding: 14,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#71717A', fontSize: 11, marginTop: 4, fontWeight: '500' },

  section: { marginTop: 28 },
  sectionTitle: {
    color: '#A1A1AA', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },

  actionsWrap: { gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111117', borderRadius: 12,
    borderWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 16, paddingVertical: 15,
  },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  actionArrow: { color: '#F97316', fontSize: 18, fontWeight: '700' },

  listCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111117', borderRadius: 12,
    borderWidth: 1, borderColor: '#27272A',
    padding: 14, marginBottom: 10, overflow: 'hidden',
  },
  listAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: 12 },
  listTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  listSubtitle: { color: '#A1A1AA', fontSize: 12, marginTop: 3 },
  listMeta: { fontSize: 11, fontWeight: '700', marginLeft: 10 },

  emptyState: { alignItems: 'center', paddingTop: 64 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyBody: { color: '#52525B', fontSize: 13, marginTop: 6, textAlign: 'center', maxWidth: 260 },
})
