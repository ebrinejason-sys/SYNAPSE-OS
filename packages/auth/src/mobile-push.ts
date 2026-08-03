/**
 * Expo push delivery for Synapse mobile.
 * Uses the Expo Push HTTP API (no expo-server-sdk dependency).
 */
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

export type MobileDeepLink =
  | 'app:/home'
  | 'app:/queue'
  | 'app:/records'
  | 'app:/appointments'
  | 'app:/stock'
  | 'app:/lab'
  | 'app:/claims'
  | `app:/${string}`

export type ExpoPushMessage = {
  title: string
  body: string
  /** In-app deep link consumed by the Expo client */
  target: MobileDeepLink
  data?: Record<string, unknown>
  sound?: 'default' | null
  priority?: 'default' | 'normal' | 'high'
}

export type PushTargetFilter = {
  /** Exact user ids */
  userIds?: string[]
  /** Tenant scope — omit for platform-wide */
  tenantId?: string | null
  /** Role allow-list (exact profile.role values stored on the token row) */
  roles?: string[]
  /** Cap tokens per send to avoid Expo rate limits */
  limit?: number
}

const CLINICAL_QUEUE_ROLES = [
  'doctor',
  'independent_doctor',
  'clinician',
  'clinical_officer',
  'specialist',
  'surgeon',
  'nurse',
  'theatre_nurse',
  'icu_nurse',
  'receptionist',
  'admin',
  'hospital_admin',
  'facility_admin',
]

const PHARMACY_STOCK_ROLES = [
  'pharmacist',
  'pharmacy_admin',
  'pharmacy_store_manager',
  'pharmacy_staff',
  'pharmacy_ceo',
  'pharmacy_cashier',
]

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const CHUNK = 100

function isExpoToken(token: string): boolean {
  return (
    token.startsWith('ExponentPushToken[') ||
    token.startsWith('ExpoPushToken[')
  )
}

async function loadTokens(filter: PushTargetFilter): Promise<string[]> {
  const limit = Math.min(Math.max(filter.limit ?? 500, 1), 2000)
  let query = db()
    .from('mobile_push_tokens')
    .select('token')
    .limit(limit)

  if (filter.userIds?.length) {
    query = query.in('user_id', filter.userIds)
  }
  if (filter.tenantId) {
    query = query.eq('tenant_id', filter.tenantId)
  }
  if (filter.roles?.length) {
    query = query.in('role', filter.roles)
  }

  const { data, error } = await query
  if (error) {
    console.error('[mobile-push] token query failed:', error.message)
    return []
  }

  const seen = new Set<string>()
  const tokens: string[] = []
  for (const row of data ?? []) {
    const token = String((row as { token?: string }).token ?? '')
    if (!token || !isExpoToken(token) || seen.has(token)) continue
    seen.add(token)
    tokens.push(token)
  }
  return tokens
}

async function postExpo(messages: Array<Record<string, unknown>>): Promise<number> {
  if (messages.length === 0) return 0
  let sent = 0
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK)
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('[mobile-push] Expo API error:', res.status, text.slice(0, 300))
        continue
      }
      sent += chunk.length
    } catch (err) {
      console.error('[mobile-push] Expo fetch failed:', err)
    }
  }
  return sent
}

/**
 * Send a push to matching device tokens. Never throws — safe for fire-and-forget.
 * Returns number of messages accepted by Expo (not delivery receipts).
 */
export async function sendMobilePush(
  message: ExpoPushMessage,
  filter: PushTargetFilter,
): Promise<number> {
  try {
    const tokens = await loadTokens(filter)
    if (tokens.length === 0) return 0

    const payload = tokens.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      sound: message.sound ?? 'default',
      priority: message.priority ?? 'high',
      data: {
        ...(message.data ?? {}),
        url: message.target,
        target: message.target,
      },
    }))

    return await postExpo(payload)
  } catch (err) {
    console.error('[mobile-push] sendMobilePush failed:', err)
    return 0
  }
}

/** Fire-and-forget wrapper — does not block the request. */
export function notifyMobilePush(message: ExpoPushMessage, filter: PushTargetFilter): void {
  void sendMobilePush(message, filter)
}

export function notifyClinicalQueue(input: {
  tenantId: string
  patientLabel?: string | null
  chiefComplaint?: string | null
}): void {
  // Discreet lock-screen copy — no names or clinical detail (Release 0 App privacy).
  void input.patientLabel
  void input.chiefComplaint
  notifyMobilePush(
    {
      title: 'Queue update',
      body: 'Open Synapse to review the clinical queue.',
      target: 'app:/queue',
      data: { kind: 'queue' },
    },
    { tenantId: input.tenantId, roles: CLINICAL_QUEUE_ROLES, limit: 200 },
  )
}

export function notifyPlatformBroadcast(input: {
  title: string
  body: string
  severity?: string
}): void {
  notifyMobilePush(
    {
      title: input.title.slice(0, 80) || 'Synapse alert',
      body: input.body.slice(0, 180),
      target: 'app:/home',
      data: { kind: 'broadcast', severity: input.severity ?? 'info' },
      priority: input.severity === 'critical' ? 'high' : 'default',
    },
    { limit: 1000 },
  )
}

export function notifyPharmacyStock(input: {
  tenantId: string
  productName: string
  reason: 'reorder' | 'expiry'
  detail?: string
}): void {
  const title =
    input.reason === 'reorder' ? 'Stock below reorder level' : 'Product expiring soon'
  void input.productName
  void input.detail
  notifyMobilePush(
    {
      title,
      body:
        input.reason === 'reorder'
          ? 'Open Synapse to review stock levels.'
          : 'Open Synapse to review products nearing expiry.',
      target: 'app:/stock',
      data: { kind: 'stock', reason: input.reason },
    },
    { tenantId: input.tenantId, roles: PHARMACY_STOCK_ROLES, limit: 100 },
  )
}

export function notifyPatientAppointment(input: {
  userId: string
  title: string
  body: string
}): void {
  void input.body
  notifyMobilePush(
    {
      title: input.title.slice(0, 80) || 'Appointment reminder',
      body: 'Open Synapse to view your upcoming visit details.',
      target: 'app:/appointments',
      data: { kind: 'appointment' },
    },
    { userIds: [input.userId], limit: 10 },
  )
}

export function notifyPatientLabResult(input: {
  userId: string
  testName?: string | null
}): void {
  void input.testName
  notifyMobilePush(
    {
      title: 'Health update',
      body: 'Open Synapse to view a new result in your records.',
      target: 'app:/records',
      data: { kind: 'lab_result' },
    },
    { userIds: [input.userId], limit: 10 },
  )
}

export { CLINICAL_QUEUE_ROLES, PHARMACY_STOCK_ROLES }
