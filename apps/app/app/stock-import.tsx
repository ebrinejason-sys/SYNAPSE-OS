import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { apiRequest, ApiError } from '@/lib/api'
import { colors, radii, spacing, typography } from '@/lib/theme'

const SAMPLE = `name,sku,price,quantity,cost_price,category,unit,batch,expiry
Amoxicillin 500mg,AMX-500,2500,100,1800,Antibiotics,Tablet,B1,2027-06-30
ORS Sachet,ORS-1,500,200,300,OTC,Sachet,,`

const PORTAL_IMPORT = 'https://pharm.synapseos.tech/portal/inventory'

export default function StockImportScreen() {
  const { token } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [csv, setCsv] = useState(SAMPLE)
  const [saving, setSaving] = useState(false)

  const runImport = async () => {
    if (!token) return
    if (!csv.trim()) {
      Alert.alert('Empty CSV', 'Paste product rows first.')
      return
    }
    setSaving(true)
    try {
      const data = await apiRequest<{
        ok: boolean
        created: number
        skipped: string[]
        errors: string[]
      }>('/api/mobile/pharmacy/inventory/bulk-upload', {
        method: 'POST',
        token,
        body: { csv },
      })
      const bits = [
        `Created ${data.created}`,
        data.skipped.length ? `skipped ${data.skipped.length}` : null,
        data.errors.length ? `errors ${data.errors.length}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      Alert.alert('Import finished', bits, [
        { text: 'Stock list', onPress: () => router.replace('/(main)/stock' as never) },
        { text: 'OK' },
      ])
    } catch (err) {
      Alert.alert(
        'Import failed',
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Try again',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.title}>Bulk import</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.help}>
          Paste a CSV with a header row. Flexible columns: name, sku, price, quantity,
          cost_price, category, unit, batch, expiry. For Excel (.xlsx), use the pharmacy portal.
        </Text>

        <TextInput
          style={styles.area}
          value={csv}
          onChangeText={setCsv}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
          placeholderTextColor={colors.textMuted}
        />

        <Button label="Import CSV" onPress={runImport} loading={saving} />
        <Button
          label="Open portal inventory (Excel)"
          onPress={() => Linking.openURL(PORTAL_IMPORT).catch(() => {})}
          variant="ghost"
          style={styles.portalBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 48 },
  title: {
    ...typography.h3,
    color: colors.text,
    fontFamily: 'DMSans_700Bold',
  },
  content: { padding: spacing.xl, gap: spacing.md },
  help: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 20,
  },
  area: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.bgElevated,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
  },
  portalBtn: { marginTop: spacing.sm },
})
