import Constants from 'expo-constants'

/** Apex redirects POST to www; Android fetch often drops the body on that redirect. */
function resolveApiBaseUrl(): string {
  const raw = (
    (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ?? 'https://www.synapseos.tech'
  ).replace(/\/$/, '')
  try {
    const url = new URL(raw)
    if (url.hostname === 'synapseos.tech') {
      url.hostname = 'www.synapseos.tech'
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return 'https://www.synapseos.tech'
  }
}

const BASE_URL = resolveApiBaseUrl()

/** Absolute API base URL (e.g. for building document/print URLs). */
export function apiBaseUrl(): string {
  return BASE_URL
}

const DEFAULT_TIMEOUT_MS = 45_000

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

/** Non-2xx API response. `status` lets callers branch (401 → re-login,
 * 402 → billing-locked screen) instead of string-matching messages. */
export class ApiError extends Error {
  readonly status: number
  readonly payload: Record<string, unknown>

  constructor(message: string, status: number, payload: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

/** True when the server returned the Workstream C subscription lock (HTTP 402). */
export function isSubscriptionLocked(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 402
}

interface RequestOptions {
  method?: Method
  body?: unknown
  token?: string | null
  timeoutMs?: number
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-App': 'mobile',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.')
    }
    throw new Error('Network error. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {}

  if (!res.ok) {
    const payload = data as Record<string, unknown>
    const message =
      (typeof payload.message === 'string' && payload.message) ||
      (typeof payload.error === 'string' && payload.error) ||
      `Request failed (${res.status})`
    throw new ApiError(message, res.status, payload)
  }

  if (!contentType.includes('application/json')) {
    throw new Error('Unexpected server response. Try again in a moment.')
  }

  return data as T
}

/** Fetch a non-JSON (e.g. text/html) endpoint with auth. Used for print-ready receipt HTML. */
export async function apiFetchText(
  path: string,
  { token, timeoutMs = DEFAULT_TIMEOUT_MS }: { token?: string | null; timeoutMs?: number } = {},
): Promise<string> {
  const headers: Record<string, string> = { Accept: 'text/html', 'X-App': 'mobile' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.')
    }
    throw new Error('Network error. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status})`, res.status)
  }
  return res.text()
}

// ── Pharmacy mobile BFF helpers ──────────────────────────────────────────────

export type PharmacySupplier = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  contactPerson: string | null
  notes: string | null
  isActive: boolean
  purchaseOrderCount?: number
}

export type PharmacyPurchaseOrder = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  notes: string | null
  expectedDate: string | null
  createdAt: string | null
  supplier: { id: string; name: string; email: string | null; phone: string | null }
  items: Array<{
    id: string
    productId: string | null
    productName: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  createdByName?: string
}

export type PharmacySettings = {
  pharmacyName: string
  receiptHeader: string
  receiptFooter: string
  currency?: string
  lowStockThreshold?: number
  location?: string
  contact?: string
  email?: string
}

export type PharmacyStaffUser = {
  id: string
  name: string
  email: string
  username: string | null
  role: string | null
  isActive: boolean
  createdAt: string | null
}

export function fetchPharmacySuppliers(token: string) {
  return apiRequest<{ suppliers: PharmacySupplier[] }>('/api/mobile/pharmacy/suppliers', {
    token,
  })
}

export function createPharmacySupplier(
  token: string,
  body: {
    name: string
    email: string
    phone?: string
    address?: string
    contactPerson?: string
    notes?: string
  },
) {
  return apiRequest<{ ok: boolean; supplier: PharmacySupplier }>(
    '/api/mobile/pharmacy/suppliers',
    { method: 'POST', token, body },
  )
}

export function fetchPharmacyPurchaseOrders(token: string, supplierId?: string) {
  const q = supplierId ? `?supplierId=${encodeURIComponent(supplierId)}` : ''
  return apiRequest<{ purchaseOrders: PharmacyPurchaseOrder[] }>(
    `/api/mobile/pharmacy/purchase-orders${q}`,
    { token },
  )
}

export function createPharmacyPurchaseOrder(
  token: string,
  body: {
    supplierId: string
    items: Array<{ productId?: string; productName: string; quantity: number; unitPrice: number }>
    notes?: string
    expectedDate?: string
  },
) {
  return apiRequest<{ ok: boolean; purchaseOrder: PharmacyPurchaseOrder }>(
    '/api/mobile/pharmacy/purchase-orders',
    { method: 'POST', token, body },
  )
}

export function updatePharmacyPurchaseOrderStatus(
  token: string,
  body: {
    id: string
    status: string
    receiptItems?: Array<{
      productId: string
      batchNumber: string
      expiryDate: string
      quantity?: number
      costPrice?: number
    }>
  },
) {
  return apiRequest<{
    ok: boolean
    purchaseOrder: PharmacyPurchaseOrder | null
    received?: Array<{ productId: string; batchId: string; quantity: number }>
  }>('/api/mobile/pharmacy/purchase-orders', { method: 'PATCH', token, body })
}

export function fetchPharmacyReport(
  token: string,
  type: 'sales' | 'inventory' | 'low-stock' | 'expiry' | 'refunds',
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams({ type })
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return apiRequest<Record<string, unknown>>(`/api/mobile/pharmacy/reports?${params}`, {
    token,
  })
}

export function fetchPharmacySettings(token: string) {
  return apiRequest<{ settings: PharmacySettings }>('/api/mobile/pharmacy/settings', { token })
}

export function patchPharmacySettings(
  token: string,
  body: { pharmacyName?: string; receiptHeader?: string; receiptFooter?: string },
) {
  return apiRequest<{ ok: boolean; settings: PharmacySettings }>(
    '/api/mobile/pharmacy/settings',
    { method: 'PATCH', token, body },
  )
}

export function fetchPharmacyUsers(token: string) {
  return apiRequest<{ users: PharmacyStaffUser[] }>('/api/mobile/pharmacy/users', { token })
}

export function receivePharmacyStockMobile(
  token: string,
  body: {
    productId: string
    batchNumber: string
    quantity: number
    expiryDate: string
    costPrice?: number
    sellingPrice?: number
    supplierId?: string
    reason?: string
  },
) {
  return apiRequest<{
    ok: boolean
    productId: string
    batchId: string | null
    received: number
    productName?: string
  }>('/api/mobile/pharmacy/receiving', { method: 'POST', token, body })
}

export function fetchPharmacyRefunds(token: string) {
  return apiRequest<{
    refunds: Array<{
      id: string
      receiptNumber: string
      totalAmount: number
      paymentMethod: string | null
      status: string
      reason: string | null
      voidedAt: string | null
      createdAt: string
    }>
  }>('/api/mobile/pharmacy/refunds', { token })
}

export function postPharmacyRefund(
  token: string,
  body: { saleId: string; reason: string; restoreAs?: 'active' | 'quarantined' },
) {
  return apiRequest<{
    ok: boolean
    saleId: string
    receiptNumber?: string
    refundAmount: number
    restoreAs: string
    status: string
  }>('/api/mobile/pharmacy/refunds', { method: 'POST', token, body })
}

export function searchPosProducts(token: string, q: string) {
  const params = new URLSearchParams({ q, limit: '40' })
  return apiRequest<{
    products: Array<{
      id: string
      name: string
      sku: string | null
      barcode: string | null
      price: number
      costPrice: number | null
      quantity: number
      sellableQuantity?: number
    }>
  }>(`/api/mobile/pharmacy/pos/products?${params}`, { token })
}
