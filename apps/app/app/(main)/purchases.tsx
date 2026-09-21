import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingBlock } from '@/components/ui/LoadingBlock'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/lib/auth'
import {
  ApiError,
  createPharmacyPurchase,
  createPharmacySupplier,
  fetchPharmacyPurchases,
  fetchPharmacySuppliers,
  searchPosProducts,
  type PharmacyPurchase,
  type PharmacySupplier,
} from '@/lib/api'
import { colors, radii, spacing, tabBarHeight, typography } from '@/lib/theme'

type Line = {
  clientItemId: string
  productId: string
  productName: string
  quantity: string
  unitCost: string
  batchNumber: string
  expiryDate: string
}

export default function PurchasesScreen() {
  const { token } = useAuth()
  const insets = useSafeAreaInsets()
  const [purchases, setPurchases] = useState<PharmacyPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [suppliers, setSuppliers] = useState<PharmacySupplier[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [invoice, setInvoice] = useState('')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Array<{ id: string; name: string; costPrice: number | null }>>([])
  const [lines, setLines] = useState<Line[]>([])
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('')
  const [batch, setBatch] = useState('')
  const [expiry, setExpiry] = useState('')
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const receiveKeyRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const data = await fetchPharmacyPurchases(token)
      setPurchases(data.purchases)
    } catch {
      setPurchases([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const openNew = async () => {
    if (!token) return
    setShowNew(true)
    try {
      const data = await fetchPharmacySuppliers(token)
      setSuppliers(data.suppliers)
      if (data.suppliers[0]) setSupplierId(data.suppliers[0].id)
    } catch {
      setSuppliers([])
    }
  }

  const search = async (q: string) => {
    setQuery(q)
    if (!token || q.trim().length < 2) {
      setHits([])
      return
    }
    try {
      const data = await searchPosProducts(token, q.trim())
      setHits(data.products.map((p) => ({ id: p.id, name: p.name, costPrice: p.costPrice })))
    } catch {
      setHits([])
    }
  }

  const addLine = () => {
    if (!picked) return
    if (!batch.trim() || !(Number(qty) > 0) || !expiry.trim()) {
      Alert.alert('Batch required', 'Enter quantity, batch number, expiry and cost.')
      return
    }
    setLines((prev) => [
      ...prev,
      {
        clientItemId: `${Date.now()}`,
        productId: picked.id,
        productName: picked.name,
        quantity: qty,
        unitCost: cost || '0',
        batchNumber: batch.trim(),
        expiryDate: expiry.trim(),
      },
    ])
    setPicked(null)
    setQuery('')
    setHits([])
    setQty('1')
    setCost('')
    setBatch('')
    setExpiry('')
  }

  const submit = async () => {
    if (!token) return
    if (!supplierId || lines.length === 0) {
      Alert.alert('Required', 'Pick a supplier and add items.')
      return
    }
    setSaving(true)
    const idempotencyKey = receiveKeyRef.current ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    receiveKeyRef.current = idempotencyKey
    try {
      await createPharmacyPurchase(token, {
        supplierId,
        supplierInvoiceNo: invoice || undefined,
        idempotencyKey,
        receiveNow: true,
        lines: lines.map((line) => ({
          clientItemId: line.clientItemId,
          productId: line.productId,
          productName: line.productName,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate,
        })),
      })
      receiveKeyRef.current = null
      setShowNew(false)
      setLines([])
      await load()
      Alert.alert('Received', 'Purchase received. Inventory updated from genuine batches.')
    } catch (err) {
      Alert.alert('Receive failed', err instanceof ApiError ? err.message : 'Try again. Inventory is not updated until the server accepts the receipt.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingBlock />

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + tabBarHeight }]}>
      <View style={styles.header}>
        <Text style={[typography.title, { color: colors.text }]}>Purchases</Text>
        <Button label="New Purchase" onPress={() => void openNew()} />
      </View>
      {purchases.length === 0 ? (
        <EmptyState title="No purchases yet" subtitle="Record a walk-in purchase without creating a purchase order first." />
      ) : (
        <FlatList
          data={purchases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={[typography.subtitle, { color: colors.text }]}>{item.purchaseNo}</Text>
              <Text style={{ color: colors.textSecondary }}>{item.supplier.name}</Text>
              <Text style={{ color: colors.textMuted }}>
                {item.purchaseDate ?? ''} · {item.status} · {item.paymentStatus}
              </Text>
              <Text style={{ color: colors.text }}>{item.total.toLocaleString()} · {item.items.length} items</Text>
            </View>
          )}
        />
      )}

      <Modal visible={showNew} animationType="slide" onRequestClose={() => setShowNew(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, gap: spacing.md }}>
            <Text style={[typography.title, { color: colors.text }]}>New Purchase</Text>
            <Text style={{ color: colors.textSecondary }}>Supplier</Text>
            {suppliers.map((s) => (
              <Pressable key={s.id} onPress={() => setSupplierId(s.id)} style={[styles.card, supplierId === s.id && { borderColor: colors.primary }]}>
                <Text style={{ color: colors.text }}>{s.name}</Text>
              </Pressable>
            ))}
            <TextField label="Or create supplier" value={newSupplierName} onChangeText={setNewSupplierName} />
            <Button
              label="Create supplier"
              variant="ghost"
              onPress={async () => {
                if (!token || !newSupplierName.trim()) return
                const created = await createPharmacySupplier(token, { name: newSupplierName.trim() })
                setSuppliers((prev) => [created.supplier, ...prev])
                setSupplierId(created.supplier.id)
                setNewSupplierName('')
              }}
            />
            <TextField label="Supplier invoice" value={invoice} onChangeText={setInvoice} />
            <TextField label="Scan / search product" value={query} onChangeText={(v) => void search(v)} />
            {hits.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  setPicked(p)
                  setCost(p.costPrice != null ? String(p.costPrice) : '')
                }}
                style={styles.card}
              >
                <Text style={{ color: colors.text }}>{p.name}</Text>
                <Text style={{ color: colors.textMuted }}>Existing product</Text>
              </Pressable>
            ))}
            {picked && (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text }}>{picked.name}</Text>
                <TextField label="Quantity" value={qty} onChangeText={setQty} keyboardType="numeric" />
                <TextField label="Cost" value={cost} onChangeText={setCost} keyboardType="numeric" />
                <TextField label="Batch" value={batch} onChangeText={setBatch} />
                <TextField label="Expiry YYYY-MM-DD" value={expiry} onChangeText={setExpiry} />
                <Button label="Add item" onPress={addLine} />
              </View>
            )}
            {lines.map((line) => (
              <Text key={line.clientItemId} style={{ color: colors.textSecondary }}>
                {line.productName} × {line.quantity} · {line.batchNumber}
              </Text>
            ))}
            <Button label={saving ? 'Receiving…' : 'Receive'} onPress={() => void submit()} disabled={saving} />
            <Button label="Cancel" variant="ghost" onPress={() => setShowNew(false)} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.bgSubtle,
  },
})
