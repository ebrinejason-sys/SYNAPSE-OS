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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingBlock } from '@/components/ui/LoadingBlock'
import { useAuth } from '@/lib/auth'
import { apiRequest, ApiError } from '@/lib/api'
import { colors, radii, spacing, typography, TONE_COLORS } from '@/lib/theme'

const CART_DRAFT_KEY = 'synapse.pharmacy.pos.draft.v1'

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
  key: string
  productId: string
  name: string
  unitPrice: number
  quantity: number
  batchId: string | null
  batchLabel: string | null
  packageLabel: string | null
  discountAmount: number
  unitsPerPackage: number
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
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false)
  const [cartDiscount, setCartDiscount] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastSale, setLastSale] = useState<SaleResult | null>(null)
  const [lowStock, setLowStock] = useState<LowStockItem[]>([])
  const idempotencyRef = useRef(newIdempotencyKey())
  const [draftRestored, setDraftRestored] = useState(false)
  const [pendingSync, setPendingSync] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 280)
    return () => clearTimeout(t)
  }, [query])

  // Restore unfinished cart draft (local only — never treated as a completed sale).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_DRAFT_KEY)
        if (!raw || cancelled) return
        const parsed = JSON.parse(raw) as {
          cart?: CartLine[]
          payment?: (typeof PAYMENTS)[number]['key']
          cartDiscount?: string
          discountReason?: string
          idempotencyKey?: string
        }
        if (Array.isArray(parsed.cart) && parsed.cart.length > 0) {
          setCart(parsed.cart)
          if (parsed.payment) setPayment(parsed.payment)
          if (parsed.cartDiscount) setCartDiscount(parsed.cartDiscount)
          if (parsed.discountReason) setDiscountReason(parsed.discountReason)
          if (parsed.idempotencyKey) idempotencyRef.current = parsed.idempotencyKey
        }
      } catch {
        /* ignore corrupt draft */
      } finally {
        if (!cancelled) setDraftRestored(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Persist draft cart locally. Financial completion still requires server confirmation.
  useEffect(() => {
    if (!draftRestored) return
    const payload = {
      cart,
      payment,
      cartDiscount,
      discountReason,
      idempotencyKey: idempotencyRef.current,
      updatedAt: new Date().toISOString(),
    }
    if (cart.length === 0) {
      void AsyncStorage.removeItem(CART_DRAFT_KEY)
      return
    }
    void AsyncStorage.setItem(CART_DRAFT_KEY, JSON.stringify(payload))
  }, [cart, payment, cartDiscount, discountReason, draftRestored])

  // Load pharmacy printer preference once for auto-print after sale.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) return
      try {
        const data = await apiRequest<{ settings?: { autoPrintReceipt?: boolean } }>(
          '/api/mobile/pharmacy/settings',
          { token },
        )
        if (!cancelled) setAutoPrintReceipt(Boolean(data.settings?.autoPrintReceipt))
      } catch {
        /* non-fatal */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

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
  const discountN = Math.max(0, Number(cartDiscount) || 0)
  const total = Math.max(0, subtotal - discountN)

  const pushLine = (line: Omit<CartLine, 'key' | 'discountAmount'>) => {
    setLastSale(null)
    setCart((prev) => [
      ...prev,
      {
        ...line,
        key: `${line.productId}-${line.batchId ?? 'nb'}-${line.packageLabel ?? 'u'}-${Date.now()}`,
        discountAmount: 0,
      },
    ])
  }

  const chooseBatchThenAdd = (
    p: PosProduct,
    opts: { units: number; unitPrice: number; packageLabel: string | null },
  ) => {
    const batches = p.batches
    const finish = (batchId: string | null, batchLabel: string | null) => {
      pushLine({
        productId: p.id,
        name: p.name,
        unitPrice: opts.unitPrice,
        quantity: opts.units,
        batchId,
        batchLabel,
        packageLabel: opts.packageLabel,
        unitsPerPackage: opts.packageLabel ? opts.units : 1,
      })
    }
    if (batches.length <= 1) {
      finish(batches[0]?.id ?? null, batches[0] ? `${batches[0].batchNumber}` : null)
      return
    }
    Alert.alert(
      'Pick FEFO batch',
      'Batches are sorted earliest expiry first.',
      [
        ...batches.slice(0, 5).map((b) => ({
          text: `${b.batchNumber} · ${b.quantity} · exp ${String(b.expiryDate).slice(0, 10)}`,
          onPress: () => finish(b.id, b.batchNumber),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    )
  }

  const addProduct = (p: PosProduct) => {
    if (p.quantity <= 0) {
      Alert.alert('Out of stock', `${p.name} has no sellable quantity.`)
      return
    }
    const pkgs = p.packages.filter((x) => x.unitsPerPackage > 0 && x.price >= 0)
    if (pkgs.length === 0) {
      chooseBatchThenAdd(p, { units: 1, unitPrice: p.price, packageLabel: null })
      return
    }
    Alert.alert('Sell as', p.name, [
      {
        text: `Unit · UGX ${p.price.toLocaleString()}`,
        onPress: () =>
          chooseBatchThenAdd(p, { units: 1, unitPrice: p.price, packageLabel: null }),
      },
      ...pkgs.slice(0, 4).map((pkg) => ({
        text: `${pkg.name} (${pkg.unitsPerPackage}) · UGX ${pkg.price.toLocaleString()}`,
        onPress: () =>
          chooseBatchThenAdd(p, {
            units: pkg.unitsPerPackage,
            unitPrice: pkg.price / pkg.unitsPerPackage,
            packageLabel: pkg.name,
          }),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ])
  }

  const bumpQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.key !== key) return l
          const step = l.packageLabel ? l.unitsPerPackage : 1
          return { ...l, quantity: l.quantity + delta * step }
        })
        .filter((l) => l.quantity > 0),
    )
  }

  const clearCart = () => {
    setCart([])
    setCartDiscount('')
    setDiscountReason('')
    setPendingSync(false)
    idempotencyRef.current = newIdempotencyKey()
    void AsyncStorage.removeItem(CART_DRAFT_KEY)
  }

  const completeSale = async () => {
    if (!token || cart.length === 0) return
    if (discountN > 0 && !discountReason.trim()) {
      Alert.alert('Discount reason', 'Enter a reason when applying a cart discount.')
      return
    }
    setSubmitting(true)
    setPendingSync(false)
    try {
      // Apply cart discount to the first line so RPC sees a single line discount (no double-count).
      const items = cart.map((l, idx) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: idx === 0 ? discountN : 0,
        discountReason: idx === 0 && discountN > 0 ? discountReason.trim() : undefined,
        batchId: l.batchId,
      }))
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
          items,
        },
      })
      setLastSale(data.sale)
      setLowStock(data.lowStock ?? [])
      setCart([])
      setCartDiscount('')
      setDiscountReason('')
      setPendingSync(false)
      idempotencyRef.current = newIdempotencyKey()
      void AsyncStorage.removeItem(CART_DRAFT_KEY)
      load()
      const saleId = data.sale.sale_id
      if (autoPrintReceipt && saleId) {
        router.push(`/receipt/${saleId}?autoprint=1` as never)
      } else if ((data.lowStock ?? []).length > 0) {
        const names = data.lowStock!.slice(0, 3).map((p) => p.name).join(', ')
        Alert.alert(
          'Sale complete — stock alert',
          `${data.sale.receipt_number ?? 'Receipt'} saved.\nNow at/below reorder: ${names}`,
        )
      }
    } catch (err) {
      const networkish =
        err instanceof Error &&
        /network|timeout|fetch failed|failed to fetch|internet/i.test(err.message)
      if (networkish) {
        setPendingSync(true)
        Alert.alert(
          'Sale not completed',
          'No internet or the server did not confirm this sale. The cart is still held as a local draft — it is NOT sold yet. Retry when connectivity returns (same receipt key prevents duplicates).',
        )
      } else {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Sale failed'
        Alert.alert('Sale failed', message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const confirmSale = () => {
    if (cart.length === 0) return
    Alert.alert(
      'Complete sale?',
      `UGX ${total.toLocaleString()} · ${PAYMENTS.find((p) => p.key === payment)?.label}${
        discountN > 0 ? ` · discount ${discountN.toLocaleString()}` : ''
      }`,
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

      {pendingSync ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>
            Sale not confirmed by server. Cart held as draft — retry when online. Not sold yet.
          </Text>
        </View>
      ) : null}

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
            {lastSale.sale_id ? (
              <Pressable
                style={styles.receiptAction}
                onPress={() => router.push(`/receipt/${lastSale.sale_id}` as never)}
              >
                <Text style={styles.receiptActionText}>View receipt</Text>
              </Pressable>
            ) : null}
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
          accessibilityLabel="Product search"
          accessibilityHint="Search by name, SKU, or barcode"
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
                <View key={line.key} style={styles.cartLine}>
                  <View style={styles.cartCopy}>
                    <Text style={styles.cartName} numberOfLines={1}>
                      {line.name}
                    </Text>
                    <Text style={styles.cartMeta}>
                      UGX {line.unitPrice.toLocaleString()} × {line.quantity}
                      {line.packageLabel ? ` · ${line.packageLabel}` : ''}
                      {line.batchLabel ? ` · ${line.batchLabel}` : ''}
                    </Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <Pressable onPress={() => bumpQty(line.key, -1)} style={styles.qtyBtn}>
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </Pressable>
                    <Text style={styles.qtyValue}>{line.quantity}</Text>
                    <Pressable onPress={() => bumpQty(line.key, 1)} style={styles.qtyBtn}>
                      <Ionicons name="add" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.discountRow}>
              <TextInput
                style={styles.discountInput}
                placeholder="Discount UGX"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={cartDiscount}
                onChangeText={setCartDiscount}
              />
              <TextInput
                style={[styles.discountInput, styles.discountReason]}
                placeholder="Reason (if discount)"
                placeholderTextColor={colors.textMuted}
                value={discountReason}
                onChangeText={setDiscountReason}
              />
            </View>

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
              <Text style={styles.totalLabel}>
                {discountN > 0 ? `Total (−${discountN.toLocaleString()})` : 'Total'}
              </Text>
              <Text style={styles.totalValue}>UGX {total.toLocaleString()}</Text>
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
  pendingBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  pendingText: {
    ...typography.caption,
    color: colors.text,
    fontFamily: 'DMSans_500Medium',
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
  discountRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  discountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.bodySm,
    backgroundColor: colors.bgElevated,
  },
  discountReason: { flex: 1.4 },
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
