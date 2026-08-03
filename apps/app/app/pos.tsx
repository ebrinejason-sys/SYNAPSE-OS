import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingBlock } from '@/components/ui/LoadingBlock'
import { useAuth } from '@/lib/auth'
import { apiRequest, ApiError } from '@/lib/api'
import { colors, radii, spacing, typography, TONE_COLORS } from '@/lib/theme'

type PosProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  price: number
  quantity: number
  unit: string
  requiresPrescription: boolean
  packages: Array<{
    id: string
    name: string
    unitsPerPackage: number
    price: number
    isDefault: boolean
  }>
  batches: Array<{
    id: string
    batchNumber: string
    quantity: number
    expiryDate: string
  }>
}

type CartLine = {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  batchId: string | null
}

type SaleResult = {
  sale_id?: string
  receipt_number?: string
  total_amount?: number
  status?: string
}

type LowStockItem = {
  id: string
  name: string
  quantity: number
  reorderLevel: number
}

const PAYMENTS = [
  { key: 'CASH', label: 'Cash' },
  { key: 'MOBILE_MONEY', label: 'Mobile money' },
  { key: 'CARD', label: 'Card' },
] as const

function newIdempotencyKey() {
  return `mpos-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function PosScreen() {
  const { token } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const cartMaxHeight = Math.min(Math.round(windowHeight * 0.36), 300)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [products, setProducts] = useState<PosProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartLine[]>([])
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]['key']>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [lastSale, setLastSale] = useState<SaleResult | null>(null)
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const idempotencyRef = useRef(newIdempotencyKey())

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 280)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const path =
        debounced.length > 0
          ? `/api/mobile/pharmacy/pos/products?q=${encodeURIComponent(debounced)}&limit=60`
          : '/api/mobile/pharmacy/pos/products?limit=60'
      const data = await apiRequest<{ products: PosProduct[] }>(path, { token })
      setProducts(data.products)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [token, debounced])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const subtotal = useMemo(
    () => cart.reduce((s, line) => s + line.unitPrice * line.quantity, 0),
    [cart],
  )

  const addProduct = (p: PosProduct) => {
    if (p.quantity <= 0) {
      Alert.alert('Out of stock', `${p.name} has no sellable quantity.`)
      return
    }
    setLastSale(null)
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id)
      if (existing) {
        if (existing.quantity >= p.quantity) {
          Alert.alert('Stock limit', `Only ${p.quantity} available.`)
          return prev
        }
        return prev.map((l) =>
          l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      const batchId = p.batches[0]?.id ?? null
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          unitPrice: p.price,
          quantity: 1,
          batchId,
        },
      ]
    })
  }

  const bumpQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.productId !== productId) return l
          return { ...l, quantity: l.quantity + delta }
        })
        .filter((l) => l.quantity > 0),
    )
  }

  const clearCart = () => {
    setCart([])
    idempotencyRef.current = newIdempotencyKey()
  }

  const completeSale = async () => {
    if (!token || cart.length === 0) return
    setSubmitting(true)
    try {
      const data = await apiRequest<{
        ok: boolean
        sale: SaleResult
        lowStock?: LowStockItem[]
        idempotentReplay?: boolean
      }>('/api/mobile/pharmacy/pos/complete-sale', {
        method: 'POST',
        token,
        body: {
          idempotencyKey: idempotencyRef.current,
          paymentMethod: payment,
          taxAmount: 0,
          items: cart.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discountAmount: 0,
            batchId: l.batchId,
          })),
        },
      })
      setLastSale(data.sale)
      setLowStock(data.lowStock ?? [])
      setCart([])
      idempotencyRef.current = newIdempotencyKey()
      load()
      if ((data.lowStock ?? []).length > 0) {
        const names = data.lowStock!.slice(0, 3).map((p) => p.name).join(', ')
        Alert.alert(
          'Sale complete — stock alert',
          `${data.sale.receipt_number ?? 'Receipt'} saved.\nNow at/below reorder: ${names}`,
        )
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Sale failed'
      Alert.alert('Sale failed', message)
    } finally {
      setSubmitting(false)
    }
  }

  const confirmSale = () => {
    if (cart.length === 0) return
    Alert.alert(
      'Complete sale?',
      `UGX ${subtotal.toLocaleString()} · ${PAYMENTS.find((p) => p.key === payment)?.label}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete', onPress: () => void completeSale() },
      ],
    )
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
        <Text style={styles.title}>New sale</Text>
        {cart.length > 0 ? (
          <Pressable onPress={clearCart} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      {lastSale ? (
        <View style={styles.receiptCard}>
          <View style={styles.receiptBanner}>
            <Ionicons name="checkmark-circle" size={18} color={TONE_COLORS.green} />
            <Text style={styles.receiptText}>
              {lastSale.receipt_number ?? 'Sale'} · UGX{' '}
              {Number(lastSale.total_amount ?? 0).toLocaleString()}
            </Text>
          </View>
          {lowStock.length > 0 ? (
            <Text style={styles.lowStockNote}>
              Low after sale: {lowStock.map((p) => `${p.name} (${p.quantity})`).join(', ')}
            </Text>
          ) : null}
          <View style={styles.receiptActions}>
            <Pressable style={styles.receiptAction} onPress={() => setLastSale(null)}>
              <Text style={styles.receiptActionText}>New sale</Text>
            </Pressable>
            <Pressable
              style={styles.receiptAction}
              onPress={() => router.push('/(main)/sales' as never)}
            >
              <Text style={styles.receiptActionText}>Sales history</Text>
            </Pressable>
            <Pressable
              style={styles.receiptAction}
              onPress={() => router.push('/tools' as never)}
            >
              <Text style={styles.receiptActionText}>Tools</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.search}
          placeholder="Search name, SKU, barcode"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.listArea}>
        {loading ? (
          <LoadingBlock message="Loading products…" />
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            style={styles.flex}
            ListEmptyComponent={
              <EmptyState
                title="No products"
                body="Try another search, or add stock from Inventory."
                icon="cube"
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.productRow, pressed && styles.pressed]}
                onPress={() => addProduct(item)}
              >
                <View style={styles.productCopy}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.productMeta}>
                    Qty {item.quantity}
                    {item.sku ? ` · ${item.sku}` : ''}
                  </Text>
                </View>
                <Text style={styles.productPrice}>{item.price.toLocaleString()}</Text>
              </Pressable>
            )}
          />
        )}
      </View>

      <View
        style={[
          styles.cartPanel,
          {
            maxHeight: cart.length > 0 ? cartMaxHeight : undefined,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        {cart.length === 0 ? (
          <Text style={styles.cartEmpty}>Tap a product to add it to the cart</Text>
        ) : (
          <>
            <ScrollView
              style={styles.cartScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {cart.map((line) => (
                <View key={line.productId} style={styles.cartLine}>
                  <View style={styles.cartCopy}>
                    <Text style={styles.cartName} numberOfLines={1}>
                      {line.name}
                    </Text>
                    <Text style={styles.cartMeta}>
                      UGX {line.unitPrice.toLocaleString()} each
                    </Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <Pressable
                      onPress={() => bumpQty(line.productId, -1)}
                      style={styles.qtyBtn}
                    >
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </Pressable>
                    <Text style={styles.qtyValue}>{line.quantity}</Text>
                    <Pressable
                      onPress={() => bumpQty(line.productId, 1)}
                      style={styles.qtyBtn}
                    >
                      <Ionicons name="add" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.payRow}>
              {PAYMENTS.map((p) => (
                <Pressable
                  key={p.key}
                  onPress={() => setPayment(p.key)}
                  style={[styles.payChip, payment === p.key && styles.payChipOn]}
                >
                  <Text
                    style={[styles.payChipText, payment === p.key && styles.payChipTextOn]}
                    numberOfLines={1}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>UGX {subtotal.toLocaleString()}</Text>
            </View>

            <Button
              label="Complete sale"
              onPress={confirmSale}
              loading={submitting}
              disabled={cart.length === 0}
            />
          </>
        )}
      </View>
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
  clear: {
    ...typography.bodyMedium,
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
    width: 48,
    textAlign: 'right',
  },
  receiptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  receiptCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: `${TONE_COLORS.green}14`,
    borderWidth: 1,
    borderColor: `${TONE_COLORS.green}33`,
    gap: spacing.sm,
  },
  receiptText: {
    ...typography.bodySm,
    color: colors.text,
    fontFamily: 'DMSans_500Medium',
    flex: 1,
  },
  lowStockNote: {
    ...typography.caption,
    color: colors.warning,
    fontFamily: 'DMSans_400Regular',
  },
  receiptActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  receiptAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  receiptActionText: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: 'DMSans_500Medium',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  search: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 12,
    fontFamily: 'DMSans_400Regular',
  },
  listArea: { flex: 1, minHeight: 120 },
  flex: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, flexGrow: 1 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  pressed: { opacity: 0.7 },
  productCopy: { flex: 1, minWidth: 0 },
  productName: {
    ...typography.bodyMedium,
    color: colors.text,
    fontFamily: 'DMSans_500Medium',
  },
  productMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'DMSans_400Regular',
    marginTop: 2,
  },
  productPrice: {
    ...typography.mono,
    color: colors.text,
    fontSize: 13,
  },
  cartPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  cartScroll: { flexGrow: 0, maxHeight: 120 },
  cartEmpty: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cartCopy: { flex: 1, minWidth: 0 },
  cartName: {
    ...typography.bodySm,
    color: colors.text,
    fontFamily: 'DMSans_500Medium',
  },
  cartMeta: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'DMSans_400Regular',
  },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  qtyValue: {
    ...typography.mono,
    minWidth: 22,
    textAlign: 'center',
    color: colors.text,
  },
  payRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  payChip: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  payChipOn: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}18`,
  },
  payChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
  payChipTextOn: { color: colors.primary },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  totalLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontFamily: 'DMSans_500Medium',
  },
  totalValue: {
    ...typography.mono,
    fontSize: 16,
    color: colors.text,
    fontFamily: 'IBMPlexMono_500Medium',
    flexShrink: 1,
  },
})
