/**
 * Snake_case DB rows → camelCase shapes expected by portal UI.
 * Keep these mappers the single source of truth for admin list/detail responses.
 */

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/** Recursively convert snake_case keys to camelCase. Arrays and primitives pass through. */
export function toCamel<T = unknown>(obj: unknown): T {
  if (obj === null || obj === undefined) return obj as T
  if (Array.isArray(obj)) return obj.map((item) => toCamel(item)) as T
  if (typeof obj !== "object") return obj as T
  if (obj instanceof Date) return obj.toISOString() as T

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    out[snakeToCamelKey(key)] = toCamel(value)
  }
  return out as T
}

export type MappedSupplier = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  contactPerson: string | null
  taxNumber: string | null
  notes: string | null
  isActive: boolean
  createdAt: string | null
  _count: { purchaseOrders: number }
}

export function mapSupplier(
  row: Record<string, unknown>,
  purchaseOrderCount = 0,
): MappedSupplier {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    contactPerson: (row.contact_person as string | null) ?? null,
    taxNumber: (row.tax_number as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    isActive: Boolean(row.is_active ?? true),
    createdAt: (row.created_at as string | null) ?? null,
    _count: { purchaseOrders: purchaseOrderCount },
  }
}

export type MappedPurchaseOrderItem = {
  id: string
  productId: string | null
  productName: string
  quantity: number
  receivedQuantity: number
  unitPrice: number
  totalPrice: number
  product?: { name: string; sku: string }
}

export type MappedPurchaseOrder = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  notes: string | null
  expectedDate: string | null
  createdAt: string | null
  updatedAt: string | null
  supplier: {
    id: string
    name: string
    email: string | null
    phone: string | null
  }
  items: MappedPurchaseOrderItem[]
  createdBy: { name: string }
}

function mapPoItem(item: Record<string, unknown>): MappedPurchaseOrderItem {
  const product = item.product as Record<string, unknown> | undefined
  return {
    id: String(item.id),
    productId: (item.product_id as string | null) ?? null,
    productName: String(item.product_name ?? ""),
    quantity: Number(item.quantity ?? 0),
    receivedQuantity: Number(item.received_quantity ?? 0),
    unitPrice: Number(item.unit_price ?? 0),
    totalPrice: Number(item.total_price ?? 0),
    ...(product
      ? {
          product: {
            name: String(product.name ?? ""),
            sku: String(product.sku ?? ""),
          },
        }
      : {}),
  }
}

export function mapPurchaseOrder(
  row: Record<string, unknown>,
  createdByName?: string | null,
): MappedPurchaseOrder {
  const supplierRaw = (row.supplier as Record<string, unknown> | null) ?? null
  const itemsRaw = (row.items as Record<string, unknown>[] | null) ?? []

  return {
    id: String(row.id),
    orderNumber: String(row.order_no ?? row.orderNumber ?? ""),
    status: String(row.status ?? "DRAFT"),
    totalAmount: Number(row.total_amount ?? 0),
    notes: (row.notes as string | null) ?? null,
    expectedDate: (row.expected_date as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
    supplier: {
      id: String(supplierRaw?.id ?? row.supplier_id ?? ""),
      name: String(supplierRaw?.name ?? ""),
      email: (supplierRaw?.email as string | null) ?? null,
      phone: (supplierRaw?.phone as string | null) ?? null,
    },
    items: itemsRaw.map(mapPoItem),
    createdBy: { name: createdByName ?? "Unknown" },
  }
}

export type MappedPurchaseItem = {
  id: string
  productId: string | null
  productName: string
  quantity: number
  receivedQuantity: number
  purchaseUnit: string | null
  unitCost: number
  lineTotal: number
  batchNumber: string | null
  expiryDate: string | null
  manufactureDate: string | null
  batchId: string | null
  sellingPrice: number | null
  supplierProductRef: string | null
}

export type MappedPurchase = {
  id: string
  purchaseNo: string
  status: string
  paymentStatus: string
  paymentMethod: string | null
  currency: string
  supplierInvoiceNo: string | null
  supplierReceiptRef: string | null
  purchaseDate: string | null
  receivedDate: string | null
  subtotal: number
  tax: number
  discount: number
  otherCost: number
  total: number
  amountPaid: number
  balance: number
  notes: string | null
  createdAt: string | null
  supplier: { id: string; name: string; email: string | null; phone: string | null }
  items: MappedPurchaseItem[]
  createdByName: string
  receivedByName: string | null
  purchaseOrderId: string | null
}

export function mapPurchase(
  row: Record<string, unknown>,
  names?: { createdByName?: string | null; receivedByName?: string | null },
): MappedPurchase {
  const supplierRaw = (row.supplier as Record<string, unknown> | null) ?? null
  const itemsRaw = (row.items as Record<string, unknown>[] | null) ?? []
  return {
    id: String(row.id),
    purchaseNo: String(row.purchase_no ?? ""),
    status: String(row.status ?? "DRAFT"),
    paymentStatus: String(row.payment_status ?? "UNPAID"),
    paymentMethod: (row.payment_method as string | null) ?? null,
    currency: String(row.currency ?? "UGX"),
    supplierInvoiceNo: (row.supplier_invoice_no as string | null) ?? null,
    supplierReceiptRef: (row.supplier_receipt_ref as string | null) ?? null,
    purchaseDate: (row.purchase_date as string | null) ?? null,
    receivedDate: (row.received_date as string | null) ?? null,
    subtotal: Number(row.subtotal ?? 0),
    tax: Number(row.tax ?? 0),
    discount: Number(row.discount ?? 0),
    otherCost: Number(row.other_cost ?? 0),
    total: Number(row.total ?? 0),
    amountPaid: Number(row.amount_paid ?? 0),
    balance: Number(row.balance ?? 0),
    notes: (row.notes as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    supplier: {
      id: String(supplierRaw?.id ?? row.supplier_id ?? ""),
      name: String(supplierRaw?.name ?? ""),
      email: (supplierRaw?.email as string | null) ?? null,
      phone: (supplierRaw?.phone as string | null) ?? null,
    },
    items: itemsRaw.map((item) => ({
      id: String(item.id),
      productId: (item.product_id as string | null) ?? null,
      productName: String(item.product_name ?? ""),
      quantity: Number(item.quantity ?? 0),
      receivedQuantity: Number(item.received_quantity ?? 0),
      purchaseUnit: (item.purchase_unit as string | null) ?? null,
      unitCost: Number(item.unit_cost ?? 0),
      lineTotal: Number(item.line_total ?? 0),
      batchNumber: (item.batch_number as string | null) ?? null,
      expiryDate: (item.expiry_date as string | null) ?? null,
      manufactureDate: (item.manufacture_date as string | null) ?? null,
      batchId: (item.batch_id as string | null) ?? null,
      sellingPrice: item.selling_price != null ? Number(item.selling_price) : null,
      supplierProductRef: (item.supplier_product_ref as string | null) ?? null,
    })),
    createdByName: names?.createdByName ?? "Unknown",
    receivedByName: names?.receivedByName ?? null,
    purchaseOrderId: (row.purchase_order_id as string | null) ?? null,
  }
}

export type MappedCustomer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: string | null
  personId: string | null
  synapseId: string | null
  _count: { orders: number; transactions: number }
}

export function mapCustomer(
  row: Record<string, unknown>,
  counts?: { orders?: number; transactions?: number },
): MappedCustomer {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    isActive: Boolean(row.is_active ?? true),
    createdAt: (row.created_at as string | null) ?? null,
    personId: (row.person_id as string | null) ?? null,
    synapseId: (row.synapse_id as string | null) ?? null,
    _count: {
      orders: counts?.orders ?? 0,
      transactions: counts?.transactions ?? 0,
    },
  }
}

export type MappedRefundItem = {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product: { name: string; sku: string }
}

export type MappedRefund = {
  id: string
  transactionNo: string
  totalAmount: number
  discount: number
  netAmount: number
  paymentMethod: string
  status: string
  notes?: string | null
  createdAt: string | null
  user: { name: string }
  customer?: { name: string }
  items: MappedRefundItem[]
  source?: string
}

function mapRefundItem(item: Record<string, unknown>): MappedRefundItem {
  const product = (item.product as Record<string, unknown> | null) ?? null
  const qty = Number(item.quantity ?? 0)
  const unitPrice = Number(item.unit_price ?? item.unitPrice ?? 0)
  return {
    id: String(item.id),
    productId: String(item.product_id ?? item.productId ?? ""),
    quantity: qty,
    unitPrice,
    totalPrice: Number(item.total_price ?? item.totalPrice ?? qty * unitPrice),
    product: {
      name: String(product?.name ?? ""),
      sku: String(product?.sku ?? ""),
    },
  }
}

/** Map POS void or pharmacy_transactions REFUNDED row to refunds page shape. */
export function mapRefund(row: Record<string, unknown>): MappedRefund {
  const cashier = row.cashier as Record<string, unknown> | undefined
  const user = row.user as Record<string, unknown> | undefined
  const customer = row.customer as Record<string, unknown> | undefined
  const itemsRaw = (row.items as Record<string, unknown>[] | null) ?? []

  const transactionNo = String(
    row.transaction_no ?? row.transactionNo ?? row.receipt_number ?? "",
  )
  const netAmount = Number(row.net_amount ?? row.netAmount ?? row.total_amount ?? 0)
  const totalAmount = Number(row.total_amount ?? row.totalAmount ?? netAmount)
  const discount = Number(row.discount ?? 0)

  return {
    id: String(row.id),
    transactionNo,
    totalAmount,
    discount,
    netAmount,
    paymentMethod: String(row.payment_method ?? row.paymentMethod ?? "CASH"),
    status: String(row.status ?? "REFUNDED"),
    notes: (row.notes as string | null | undefined) ?? null,
    createdAt:
      (row.created_at as string | null) ??
      (row.updated_at as string | null) ??
      null,
    user: {
      name: String(
        cashier?.full_name ?? user?.name ?? user?.full_name ?? "Unknown",
      ),
    },
    ...(customer?.name ? { customer: { name: String(customer.name) } } : {}),
    items: itemsRaw.map(mapRefundItem),
    ...(row.source ? { source: String(row.source) } : {}),
  }
}

export type MappedOrderItem = {
  id: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  product?: { name: string; sku: string; unitOfMeasure?: string }
}

export type MappedOrder = {
  id: string
  orderNo: string
  orderType: string
  totalAmount: number
  status: string
  paymentStatus: string
  notes?: string | null
  deliveryAddress?: string | null
  createdAt: string | null
  isOnlineOrder?: boolean
  claimedBy?: string | null
  claimedAt?: string | null
  customer?: { name: string; email: string; phone?: string | null }
  items: MappedOrderItem[]
  processedByUser?: { name: string | null } | null
  claimedByUser?: { name: string | null } | null
}

export function mapOrder(
  row: Record<string, unknown>,
  opts?: {
    processedByName?: string | null
    claimedByName?: string | null
  },
): MappedOrder {
  const customer = row.customer as Record<string, unknown> | undefined
  const itemsRaw = (row.items as Record<string, unknown>[] | null) ?? []

  return {
    id: String(row.id),
    orderNo: String(row.order_no ?? ""),
    orderType: String(row.order_type ?? "CUSTOMER"),
    totalAmount: Number(row.total_amount ?? 0),
    status: String(row.status ?? "PENDING"),
    paymentStatus: String(row.payment_status ?? "UNPAID"),
    notes: (row.notes as string | null) ?? null,
    deliveryAddress: (row.delivery_address as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    isOnlineOrder: Boolean(row.is_online_order),
    claimedBy: (row.claimed_by as string | null) ?? null,
    claimedAt: (row.claimed_at as string | null) ?? null,
    ...(customer
      ? {
          customer: {
            name: String(customer.name ?? ""),
            email: String(customer.email ?? ""),
            phone: (customer.phone as string | null) ?? null,
          },
        }
      : {}),
    items: itemsRaw.map((item) => {
      const product = item.product as Record<string, unknown> | undefined
      return {
        id: String(item.id),
        productName: String(item.product_name ?? ""),
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unit_price ?? 0),
        totalPrice: Number(item.total_price ?? 0),
        ...(product
          ? {
              product: {
                name: String(product.name ?? ""),
                sku: String(product.sku ?? ""),
                unitOfMeasure: String(
                  product.unit_of_measure ?? product.unitOfMeasure ?? "",
                ),
              },
            }
          : {}),
      }
    }),
    processedByUser: row.processed_by
      ? { name: opts?.processedByName ?? null }
      : null,
    claimedByUser: row.claimed_by
      ? { name: opts?.claimedByName ?? null }
      : null,
  }
}
