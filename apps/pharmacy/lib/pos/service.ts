// Pharmacy POS service — server-side only.
// HARD RULE: stock decrements ONLY after a human-confirmed sale (confirmed_by + confirmed_at set).

import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

// ── Types ──────────────────────────────────────────────────────────────────

export interface CartItemResolved {
  itemId:      string
  productId:   string
  batchId:     string | null
  productName: string
  quantity:    number
  unitPrice:   number
  discountAmount: number
}

// ── FEFO batch selection ────────────────────────────────────────────────────

/**
 * Selects earliest-expiry batch with sufficient stock (FEFO).
 */
export async function selectFefoBatch(
  productId: string,
  tenantId:  string,
  quantity:  number,
): Promise<{ batchId: string; expiryDate: string } | null> {
  const { data } = await db
    .from('pharmacy_product_batches')
    .select('id, expiry_date, quantity')
    .eq('product_id', productId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .gte('quantity', quantity)
    .gt('expiry_date', new Date().toISOString().slice(0, 10))
    .order('expiry_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { batchId: data.id, expiryDate: data.expiry_date }
}

// ── Cashier session ─────────────────────────────────────────────────────────

export async function openCashierSession(params: {
  tenantId:     string
  cashierId:    string
  storeId?:     string
  openingFloat: number
}): Promise<string> {
  const { data, error } = await db
    .from('pharmacy_cashier_sessions')
    .insert({
      tenant_id:     params.tenantId,
      cashier_id:    params.cashierId,
      store_id:      params.storeId ?? null,
      opening_float: params.openingFloat,
      status:        'open',
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to open cashier session: ${error.message}`)
  return data.id
}

export async function closeCashierSession(params: {
  sessionId:    string
  closingFloat: number
  notes?:       string
}): Promise<void> {
  const { error } = await db
    .from('pharmacy_cashier_sessions')
    .update({
      status:        'closed',
      closed_at:     new Date().toISOString(),
      closing_float: params.closingFloat,
      notes:         params.notes ?? null,
    })
    .eq('id', params.sessionId)
    .eq('status', 'open')

  if (error) throw new Error(`Failed to close session: ${error.message}`)
}

// ── Cart ───────────────────────────────────────────────────────────────────

export async function createCart(params: {
  tenantId:        string
  cashierId:       string
  sessionId?:      string
  prescriptionId?: string
}): Promise<string> {
  const { data, error } = await db
    .from('pharmacy_carts')
    .insert({
      tenant_id:       params.tenantId,
      cashier_id:      params.cashierId,
      session_id:      params.sessionId ?? null,
      prescription_id: params.prescriptionId ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create cart: ${error.message}`)
  return data.id
}

export async function addCartItem(params: {
  cartId:          string
  tenantId:        string
  productId:       string
  quantity:        number
  unitPrice:       number
  discountAmount?: number
}): Promise<void> {
  // Pre-select FEFO batch for display purposes only — NO stock change
  const batch = await selectFefoBatch(params.productId, params.tenantId, params.quantity)

  const { error } = await db.from('pharmacy_cart_items').insert({
    cart_id:         params.cartId,
    tenant_id:       params.tenantId,
    product_id:      params.productId,
    batch_id:        batch?.batchId ?? null,
    quantity:        params.quantity,
    unit_price:      params.unitPrice,
    discount_amount: params.discountAmount ?? 0,
  })

  if (error) throw new Error(`Failed to add cart item: ${error.message}`)
}

export async function getCartItems(cartId: string): Promise<CartItemResolved[]> {
  const { data } = await db
    .from('pharmacy_cart_items')
    .select('id, quantity, unit_price, discount_amount, batch_id, product_id, pharmacy_products(name)')
    .eq('cart_id', cartId)

  return (data ?? []).map((r: Record<string, unknown>) => ({
    itemId:         r.id as string,
    productId:      r.product_id as string,
    batchId:        r.batch_id as string | null,
    productName:    (r.pharmacy_products as Record<string, unknown>)?.name as string ?? '',
    quantity:       r.quantity as number,
    unitPrice:      Number(r.unit_price),
    discountAmount: Number(r.discount_amount),
  }))
}

// ── Sale creation (pre-confirmation) ───────────────────────────────────────

/**
 * Creates a sale in 'pending_confirmation' status.
 * NO stock decrement. A human must call confirmSale() to complete.
 */
export async function createSale(params: {
  tenantId:        string
  cartId:          string
  sessionId?:      string
  cashierId:       string
  patientId?:      string
  prescriptionId?: string
  paymentMethod:   string
  paymentRef?:     string
}): Promise<string> {
  const items = await getCartItems(params.cartId)
  if (!items.length) throw new Error('Cart is empty.')

  const subtotal      = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const discountTotal = items.reduce((s, i) => s + i.discountAmount, 0)
  const totalAmount   = subtotal - discountTotal
  const receiptNumber = `RX-${Date.now()}`

  const { data: sale, error: saleErr } = await db
    .from('pharmacy_pos_sales')
    .insert({
      tenant_id:       params.tenantId,
      cart_id:         params.cartId,
      session_id:      params.sessionId ?? null,
      cashier_id:      params.cashierId,
      patient_id:      params.patientId ?? null,
      prescription_id: params.prescriptionId ?? null,
      receipt_number:  receiptNumber,
      subtotal,
      discount_total:  discountTotal,
      tax_amount:      0,
      total_amount:    totalAmount,
      payment_method:  params.paymentMethod,
      payment_ref:     params.paymentRef ?? null,
      status:          'pending_confirmation',
    })
    .select('id')
    .single()

  if (saleErr) throw new Error(`Failed to create sale: ${saleErr.message}`)

  for (const item of items) {
    await db.from('pharmacy_pos_sale_items').insert({
      sale_id:           sale.id,
      tenant_id:         params.tenantId,
      product_id:        item.productId,
      batch_id:          item.batchId,
      quantity:          item.quantity,
      unit_price:        item.unitPrice,
      discount_amount:   item.discountAmount,
      stock_decremented: false,
    })
  }

  await db.from('pharmacy_carts').update({ status: 'checked_out' }).eq('id', params.cartId)
  return sale.id
}

// ── Human-confirmed sale ────────────────────────────────────────────────────

/**
 * RETIRED. Live POS uses complete_pharmacy_sale. Direct batch quantity
 * updates are forbidden and would create a second inventory authority.
 */
export async function confirmSale(_params: {
  saleId:      string
  tenantId:    string
  confirmedBy: string
}): Promise<void> {
  throw new Error(
    'POS_LEGACY_CONFIRM_RETIRED: use complete_pharmacy_sale. Direct batch quantity updates are forbidden.',
  )
}
