import { useEffect, useState } from 'react'
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Constants from 'expo-constants'
import { Button } from '@/components/ui/Button'
import { LoadingBlock } from '@/components/ui/LoadingBlock'
import { useAuth } from '@/lib/auth'
import { apiRequest } from '@/lib/api'
import { colors, radii, spacing, typography, TONE_COLORS } from '@/lib/theme'

interface StockItemDetail {
  id: string
  name: string
  sku: string | null
  category: string | null
  quantity: number
  unit: string | null
  reorderLevel: number
  expiryDate: string | null
  status: 'ok' | 'low' | 'expiring' | 'expired'
  batchNumber: string | null
  shelfLocation: string | null
  unitCost: number | null
  currency: string | null
}

const STATUS_COLORS: Record<string, string> = {
  ok: TONE_COLORS.green,
  low: TONE_COLORS.red,
  expiring: TONE_COLORS.warning,
  expired: TONE_COLORS.red,
}

const STATUS_LABELS: Record<string, string> = {
  ok: 'In Stock',
  low: 'Low Stock',
  expiring: 'Expiring Soon',
  expired: 'Expired',
}

const WEB_APP_URL = (
  (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ?? 'https://www.synapseos.tech'
).replace(/\/$/, '')

export default function StockItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { token } = useAuth()
  const router = useRouter()
  const [item, setItem] = useState<StockItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !token) { setLoading(false); return }
    apiRequest<{ item: StockItemDetail }>(`/api/mobile/inventory/${id}`, { token })
      .then((data) => setItem(data.item))
      .catch(() => setError('Failed to load item'))
      .finally(() => setLoading(false))
  }, [id, token])

  if (loading) {
    return <View style={styles.center}><LoadingBlock message="Loading item…" /></View>
  }

  if (error || !item) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Item not found'}</Text>
        <Button label="Go back" onPress={() => router.back()} variant="ghost" />
      </View>
    )
  }

  const statusColor = STATUS_COLORS[item.status] ?? colors.textMuted

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backRow} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
        <Text style={styles.backLabel}>Inventory</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[item.status] ?? item.status}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="In Stock" value={String(item.quantity)} unit={item.unit ?? 'units'} color={colors.text} />
        <StatCard label="Reorder At" value={String(item.reorderLevel)} unit={item.unit ?? 'units'} color={colors.warning} />
        {item.unitCost ? (
          <StatCard
            label="Unit Cost"
            value={(item.currency ?? 'UGX') + ' ' + item.unitCost.toLocaleString()}
            unit=""
            color={colors.teal}
          />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Product Details</Text>
        <View style={styles.card}>
          {item.sku ? <InfoRow label="SKU" value={item.sku} /> : null}
          {item.category ? <InfoRow label="Category" value={item.category} /> : null}
          {item.batchNumber ? <InfoRow label="Batch #" value={item.batchNumber} /> : null}
          {item.shelfLocation ? <InfoRow label="Location" value={item.shelfLocation} /> : null}
          {item.expiryDate ? (
            <InfoRow
              label="Expiry date"
              value={new Date(item.expiryDate).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
            />
          ) : null}
        </View>
      </View>

      <Button
        label="Manage in web portal"
        onPress={() => Linking.openURL(`${WEB_APP_URL}/portal/inventory`).catch(() => {})}
        variant="ghost"
        style={styles.ctaBtn}
      />
    </ScrollView>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl, gap: spacing.lg },
  errorText: { ...typography.body, color: colors.error, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl, gap: 4 },
  backLabel: { ...typography.bodyMedium, color: colors.primary, fontFamily: 'DMSans_500Medium' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.xxl },
  name: { ...typography.h2, color: colors.text, fontFamily: 'DMSans_700Bold', flex: 1 },
  statusBadge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600', fontFamily: 'DMSans_500Medium' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', fontFamily: 'DMSans_700Bold' },
  statUnit: { ...typography.caption, color: colors.textMuted, fontFamily: 'DMSans_400Regular', marginTop: 1 },
  statLabel: { ...typography.caption, color: colors.textSecondary, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  section: { marginBottom: spacing.xxl },
  sectionTitle: { ...typography.label, color: colors.textMuted, fontFamily: 'DMSans_500Medium', marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, gap: spacing.md },
  infoLabel: { ...typography.bodySm, color: colors.textSecondary, fontFamily: 'DMSans_400Regular' },
  infoValue: { ...typography.bodySm, color: colors.text, fontFamily: 'DMSans_500Medium', flex: 1, textAlign: 'right' },
  ctaBtn: { marginTop: spacing.sm },
})
