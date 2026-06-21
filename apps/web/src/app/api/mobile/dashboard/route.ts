import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// ── Role → dashboard kind (mirror of apps/app/lib/roles.ts & web resolver) ──
type DashboardKind =
  | 'patient' | 'clinician' | 'nurse' | 'pharmacy'
  | 'lab' | 'reception' | 'billing' | 'admin' | 'generic'

const ROLE_KIND: Record<string, DashboardKind> = {
  patient: 'patient',
  doctor: 'clinician', independent_doctor: 'clinician', clinician: 'clinician',
  clinical_officer: 'clinician', specialist: 'clinician', surgeon: 'clinician',
  anaesthetist: 'clinician', intensivist: 'clinician', cardiologist: 'clinician',
  oncologist: 'clinician', psychiatrist: 'clinician', nephrologist: 'clinician',
  art_clinician: 'clinician', obstetrician: 'clinician', paediatrician: 'clinician',
  radiologist: 'clinician', radiographer: 'clinician',
  nurse: 'nurse', theatre_nurse: 'nurse', icu_nurse: 'nurse',
  hiv_counselor: 'nurse', chw: 'nurse', social_worker: 'nurse',
  pharmacist: 'pharmacy', pharmacy_admin: 'pharmacy', pharmacy_store_manager: 'pharmacy',
  lab_tech: 'lab', lab_technician: 'lab', lab_supervisor: 'lab',
  receptionist: 'reception',
  billing_officer: 'billing', claims_officer: 'billing', insurance_officer: 'billing',
  admin: 'admin', hospital_admin: 'admin', facility_admin: 'admin',
  superadmin: 'admin', super_admin: 'admin', overall_admin: 'admin', platform_admin: 'admin',
}

type Tone = 'primary' | 'gold' | 'green' | 'red' | 'muted'
interface Stat { key: string; label: string; value: string; tone: Tone }
interface ListItem { id: string; title: string; subtitle?: string; meta?: string; tone?: Tone }
interface QuickAction { key: string; label: string; target: string } // target: "app:<route>" | "web:<path>"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any
const db = () => supabaseAdmin as AnyClient

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Count rows; tolerant of missing tables / column drift (returns 0 on any error). */
async function safeCount(
  table: string,
  build: (q: AnyClient) => AnyClient
): Promise<number> {
  try {
    const base = db().from(table).select('id', { count: 'exact', head: true })
    const { count, error } = await build(base)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

/** Fetch rows; tolerant of missing tables / column drift (returns [] on any error). */
async function safeRows<T = Record<string, unknown>>(
  table: string,
  columns: string,
  build: (q: AnyClient) => AnyClient
): Promise<T[]> {
  try {
    const base = db().from(table).select(columns)
    const { data, error } = await build(base)
    if (error) return []
    return (data ?? []) as T[]
  } catch {
    return []
  }
}

function money(n: number, currency = 'UGX'): string {
  return `${currency} ${Math.round(n).toLocaleString()}`
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const userId = payload.sub as string
  const role = (payload.role as string) ?? ''
  const tenantId = (payload.tenant_id as string) || ''
  const kind: DashboardKind = ROLE_KIND[role] ?? 'generic'

  // Tenant context
  let tenantName = ''
  let tenantSlug = ''
  let facilityType = ''
  if (tenantId) {
    const rows = await safeRows<{ name: string; slug: string; facility_type: string }>(
      'tenants',
      'name, slug, facility_type',
      (q) => q.eq('id', tenantId).limit(1)
    )
    if (rows[0]) {
      tenantName = rows[0].name ?? ''
      tenantSlug = rows[0].slug ?? ''
      facilityType = rows[0].facility_type ?? ''
    }
  }

  const today = startOfToday()
  let stats: Stat[] = []
  let list: { title: string; items: ListItem[] } | null = null
  let quickActions: QuickAction[] = []

  if (kind === 'pharmacy') {
    const [salesRows, lowStock, expiringSoon, pendingOrders] = await Promise.all([
      safeRows<{ total_amount: number | null }>(
        'pharmacy_pos_sales',
        'total_amount',
        (q) => q.eq('tenant_id', tenantId).gte('created_at', today).limit(1000)
      ),
      safeRows<{ id: string; name: string; quantity: number | null; reorder_level: number | null }>(
        'pharmacy_products',
        'id, name, quantity, reorder_level',
        (q) => q.eq('tenant_id', tenantId).eq('is_active', true).limit(500)
      ),
      safeCount('pharmacy_products', (q) =>
        q.eq('tenant_id', tenantId).eq('is_active', true)
          .lte('expiry_date', new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10))
      ),
      safeCount('pharmacy_orders', (q) =>
        q.eq('tenant_id', tenantId).eq('is_online_order', true).eq('status', 'pending')
      ),
    ])
    const salesTotal = salesRows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0)
    const low = lowStock.filter(
      (p) => (p.quantity ?? 0) <= (p.reorder_level ?? 0)
    )
    stats = [
      { key: 'sales', label: "Today's Sales", value: money(salesTotal), tone: 'primary' },
      { key: 'orders', label: 'Sales Today', value: String(salesRows.length), tone: 'gold' },
      { key: 'low', label: 'Low Stock', value: String(low.length), tone: low.length ? 'red' : 'green' },
      { key: 'expiring', label: 'Expiring ≤60d', value: String(expiringSoon), tone: expiringSoon ? 'red' : 'muted' },
      { key: 'online', label: 'Online Orders', value: String(pendingOrders), tone: pendingOrders ? 'gold' : 'muted' },
    ]
    if (low.length) {
      list = {
        title: 'Low Stock Alerts',
        items: low.slice(0, 10).map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: `In stock: ${p.quantity ?? 0}`,
          meta: `Reorder ≤ ${p.reorder_level ?? 0}`,
          tone: 'red' as Tone,
        })),
      }
    }
    quickActions = [
      { key: 'pos', label: 'New Sale (POS)', target: `web:/os/${tenantSlug}/pharmacy/pos` },
      { key: 'inventory', label: 'Inventory', target: `web:/os/${tenantSlug}/pharmacy/inventory` },
      { key: 'orders', label: 'Online Orders', target: `web:/os/${tenantSlug}/pharmacy/orders` },
    ]
  } else if (kind === 'clinician') {
    const [openEnc, signedToday, totalToday, queue] = await Promise.all([
      safeCount('encounters', (q) =>
        q.eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'open')
      ),
      safeCount('encounters', (q) =>
        q.eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'signed').gte('updated_at', today)
      ),
      safeCount('encounters', (q) =>
        q.eq('tenant_id', tenantId).eq('is_deleted', false).gte('created_at', today)
      ),
      safeRows<{ id: string; chief_complaint: string | null; status: string; patient_id: string | null; created_at: string }>(
        'encounters',
        'id, chief_complaint, status, patient_id, created_at',
        (q) => q.eq('tenant_id', tenantId).eq('is_deleted', false).gte('created_at', today)
          .order('created_at', { ascending: true }).limit(15)
      ),
    ])
    stats = [
      { key: 'open', label: 'Open', value: String(openEnc), tone: 'primary' },
      { key: 'today', label: 'Encounters Today', value: String(totalToday), tone: 'gold' },
      { key: 'signed', label: 'Signed Today', value: String(signedToday), tone: 'green' },
    ]
    if (queue.length) {
      const pids = [...new Set(queue.map((e) => e.patient_id).filter(Boolean))] as string[]
      const patients = pids.length
        ? await safeRows<{ id: string; full_name: string; mrn: string | null }>(
            'patients', 'id, full_name, mrn', (q) => q.in('id', pids)
          )
        : []
      const pmap = new Map(patients.map((p) => [p.id, p]))
      list = {
        title: "Today's Queue",
        items: queue.slice(0, 10).map((e) => {
          const p = e.patient_id ? pmap.get(e.patient_id) : undefined
          return {
            id: e.id,
            title: p?.full_name ?? 'Unknown patient',
            subtitle: e.chief_complaint ?? 'No chief complaint',
            meta: e.status,
            tone: (e.status === 'open' ? 'primary' : 'green') as Tone,
          }
        }),
      }
    }
    quickActions = [
      { key: 'patients', label: 'Search Patients', target: 'app:/(main)/patients' },
      { key: 'new', label: 'New Encounter', target: `web:/os/${tenantSlug}/encounters/new` },
    ]
  } else if (kind === 'nurse') {
    const [patientsCount, vitalsToday, openEnc] = await Promise.all([
      safeCount('patients', (q) => q.eq('tenant_id', tenantId).eq('is_deleted', false)),
      safeCount('vitals', (q) => q.eq('tenant_id', tenantId).gte('recorded_at', today)),
      safeCount('encounters', (q) =>
        q.eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'open')
      ),
    ])
    stats = [
      { key: 'open', label: 'Active Encounters', value: String(openEnc), tone: 'primary' },
      { key: 'vitals', label: 'Vitals Today', value: String(vitalsToday), tone: 'gold' },
      { key: 'patients', label: 'Patients', value: String(patientsCount), tone: 'muted' },
    ]
    quickActions = [
      { key: 'patients', label: 'Search Patients', target: 'app:/(main)/patients' },
      { key: 'vitals', label: 'Record Vitals', target: `web:/os/${tenantSlug}/patients` },
    ]
  } else if (kind === 'lab') {
    const [resultsToday, abnormal, pending] = await Promise.all([
      safeCount('lab_results', (q) => q.eq('tenant_id', tenantId).gte('created_at', today)),
      safeCount('lab_results', (q) =>
        q.eq('tenant_id', tenantId).not('flag', 'is', null).neq('flag', 'normal')
      ),
      safeCount('encounter_orders', (q) =>
        q.eq('tenant_id', tenantId).eq('order_type', 'lab').eq('status', 'pending')
      ),
    ])
    stats = [
      { key: 'pending', label: 'Pending Orders', value: String(pending), tone: 'primary' },
      { key: 'today', label: 'Results Today', value: String(resultsToday), tone: 'gold' },
      { key: 'abnormal', label: 'Abnormal Flags', value: String(abnormal), tone: abnormal ? 'red' : 'green' },
    ]
    quickActions = [
      { key: 'results', label: 'Enter Results', target: `web:/os/${tenantSlug}/lab` },
      { key: 'patients', label: 'Search Patients', target: 'app:/(main)/patients' },
    ]
  } else if (kind === 'reception') {
    const [patientsToday, encToday, apptToday] = await Promise.all([
      safeCount('patients', (q) =>
        q.eq('tenant_id', tenantId).eq('is_deleted', false).gte('created_at', today)
      ),
      safeCount('encounters', (q) =>
        q.eq('tenant_id', tenantId).eq('is_deleted', false).gte('created_at', today)
      ),
      safeCount('telemedicine_appointments', (q) =>
        q.eq('tenant_id', tenantId).gte('scheduled_for', today)
      ),
    ])
    stats = [
      { key: 'registered', label: 'Registered Today', value: String(patientsToday), tone: 'primary' },
      { key: 'enc', label: 'Encounters Today', value: String(encToday), tone: 'gold' },
      { key: 'appts', label: 'Appointments', value: String(apptToday), tone: 'muted' },
    ]
    quickActions = [
      { key: 'register', label: 'Register Patient', target: `web:/os/${tenantSlug}/patients/new` },
      { key: 'patients', label: 'Search Patients', target: 'app:/(main)/patients' },
    ]
  } else if (kind === 'billing') {
    const [pending, submitted, claimRows] = await Promise.all([
      safeCount('insurance_claims', (q) =>
        q.eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'pending')
      ),
      safeCount('insurance_claims', (q) =>
        q.eq('tenant_id', tenantId).eq('is_deleted', false).eq('status', 'submitted')
      ),
      safeRows<{ billed_amount: number | null }>(
        'insurance_claims', 'billed_amount',
        (q) => q.eq('tenant_id', tenantId).eq('is_deleted', false).in('status', ['pending', 'submitted']).limit(1000)
      ),
    ])
    const outstanding = claimRows.reduce((s, r) => s + (Number(r.billed_amount) || 0), 0)
    stats = [
      { key: 'pending', label: 'Pending Claims', value: String(pending), tone: 'primary' },
      { key: 'submitted', label: 'Submitted', value: String(submitted), tone: 'gold' },
      { key: 'outstanding', label: 'Outstanding', value: money(outstanding), tone: 'muted' },
    ]
    quickActions = [
      { key: 'claims', label: 'View Claims', target: `web:/os/${tenantSlug}/insurance` },
    ]
  } else if (kind === 'admin') {
    if (!tenantId) {
      // Platform admin — no single tenant. Show platform-wide overview.
      const [tenants, users, patientsAll, activeTenants] = await Promise.all([
        safeCount('tenants', (q) => q),
        safeCount('profiles', (q) => q.eq('is_deleted', false)),
        safeCount('patients', (q) => q.eq('is_deleted', false)),
        safeCount('tenants', (q) => q.eq('status', 'active')),
      ])
      stats = [
        { key: 'tenants', label: 'Facilities', value: String(tenants), tone: 'primary' },
        { key: 'active', label: 'Active', value: String(activeTenants), tone: 'green' },
        { key: 'users', label: 'Users', value: String(users), tone: 'gold' },
        { key: 'patients', label: 'Patients', value: String(patientsAll), tone: 'muted' },
      ]
      const tRows = await safeRows<{ id: string; name: string; facility_type: string; status: string }>(
        'tenants', 'id, name, facility_type, status',
        (q) => q.order('created_at', { ascending: false }).limit(10)
      )
      if (tRows.length) {
        list = {
          title: 'Recent Facilities',
          items: tRows.map((t) => ({
            id: t.id,
            title: t.name,
            subtitle: t.facility_type,
            meta: t.status,
            tone: (t.status === 'active' ? 'green' : 'muted') as Tone,
          })),
        }
      }
      quickActions = [{ key: 'platform', label: 'Platform Console', target: 'web:/platform' }]
    } else {
      const [patientsCount, staff, encToday, encTotal] = await Promise.all([
        safeCount('patients', (q) => q.eq('tenant_id', tenantId).eq('is_deleted', false)),
        safeCount('profiles', (q) => q.eq('tenant_id', tenantId).eq('is_deleted', false)),
        safeCount('encounters', (q) =>
          q.eq('tenant_id', tenantId).eq('is_deleted', false).gte('created_at', today)
        ),
        safeCount('encounters', (q) => q.eq('tenant_id', tenantId).eq('is_deleted', false)),
      ])
      stats = [
        { key: 'patients', label: 'Patients', value: String(patientsCount), tone: 'primary' },
        { key: 'staff', label: 'Staff', value: String(staff), tone: 'gold' },
        { key: 'encToday', label: 'Encounters Today', value: String(encToday), tone: 'green' },
        { key: 'encTotal', label: 'Total Encounters', value: String(encTotal), tone: 'muted' },
      ]
      quickActions = [
        { key: 'patients', label: 'Search Patients', target: 'app:/(main)/patients' },
        { key: 'portal', label: 'Admin Portal', target: `web:/os/${tenantSlug}/dashboard` },
      ]
    }
  } else if (kind === 'patient') {
    const [unread, notifs, appts] = await Promise.all([
      safeCount('notifications', (q) => q.eq('user_id', userId).eq('is_read', false)),
      safeRows<{ id: string; title: string; message: string | null; created_at: string }>(
        'notifications', 'id, title, message, created_at',
        (q) => q.eq('user_id', userId).order('created_at', { ascending: false }).limit(8)
      ),
      safeCount('telemedicine_appointments', (q) =>
        q.eq('created_by', userId).gte('scheduled_for', today)
      ),
    ])
    stats = [
      { key: 'appts', label: 'Upcoming Visits', value: String(appts), tone: 'primary' },
      { key: 'unread', label: 'Notifications', value: String(unread), tone: unread ? 'gold' : 'muted' },
    ]
    if (notifs.length) {
      list = {
        title: 'Recent Notifications',
        items: notifs.map((n) => ({
          id: n.id,
          title: n.title,
          subtitle: n.message ?? undefined,
          tone: 'muted' as Tone,
        })),
      }
    }
    quickActions = [
      { key: 'consult', label: 'Book a Consult', target: 'web:/telemedicine' },
      { key: 'records', label: 'My Records', target: 'web:/passport' },
    ]
  } else {
    // generic
    const [patientsCount, encToday] = await Promise.all([
      safeCount('patients', (q) => q.eq('tenant_id', tenantId).eq('is_deleted', false)),
      safeCount('encounters', (q) =>
        q.eq('tenant_id', tenantId).eq('is_deleted', false).gte('created_at', today)
      ),
    ])
    stats = [
      { key: 'patients', label: 'Patients', value: String(patientsCount), tone: 'primary' },
      { key: 'encToday', label: 'Encounters Today', value: String(encToday), tone: 'gold' },
    ]
  }

  return NextResponse.json({
    role,
    dashboardKind: kind,
    tenantName,
    tenantSlug,
    facilityType,
    summary: { stats, list },
    quickActions,
  })
}
