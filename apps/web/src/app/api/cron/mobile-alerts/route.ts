import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  notifyPatientAppointment,
  notifyPharmacyStock,
} from '@synapse/auth/mobile-push'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Mobile push sweep — appointment reminders (~24h ahead) + pharmacy expiry alerts (≤7 days).
 * Auth: Authorization: Bearer $CRON_SECRET (same as billing-sweep).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  const alt = req.headers.get('x-cron-secret')
  return auth === `Bearer ${secret}` || alt === secret
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const from = new Date(now + 23 * 60 * 60 * 1000).toISOString()
  const to = new Date(now + 25 * 60 * 60 * 1000).toISOString()
  const expiryCutoff = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const today = new Date(now).toISOString().slice(0, 10)

  let appointmentPushes = 0
  let stockPushes = 0

  // 1) Appointments scheduled ~24h from now
  {
    const { data: appts, error } = await db()
      .from('telemedicine_appointments')
      .select('id, patient_id, scheduled_for, status')
      .gte('scheduled_for', from)
      .lte('scheduled_for', to)
      .in('status', ['pending', 'confirmed', 'scheduled'])
      .limit(200)

    if (error) {
      console.error('[mobile-alerts] appointment query failed:', error.message)
    } else {
      for (const row of appts ?? []) {
        const userId = row.patient_id as string | null
        if (!userId) continue
        const when = row.scheduled_for
          ? new Date(row.scheduled_for as string).toLocaleString('en-UG', {
              timeZone: 'Africa/Kampala',
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : 'tomorrow'
        notifyPatientAppointment({
          userId,
          title: 'Appointment reminder',
          body: `You have a visit scheduled for ${when}.`,
        })
        appointmentPushes += 1
      }
    }
  }

  // 2) Pharmacy products expiring within 7 days (qty > 0)
  {
    const { data: products, error } = await db()
      .from('pharmacy_products')
      .select('id, tenant_id, name, quantity, expiry_date')
      .gt('quantity', 0)
      .not('expiry_date', 'is', null)
      .gte('expiry_date', today)
      .lte('expiry_date', expiryCutoff)
      .limit(300)

    if (error) {
      console.error('[mobile-alerts] expiry query failed:', error.message)
    } else {
      // One push per tenant with a summary (avoid spam)
      const byTenant = new Map<string, Array<{ name: string; expiry_date: string }>>()
      for (const p of products ?? []) {
        const tenantId = p.tenant_id as string
        if (!tenantId) continue
        const list = byTenant.get(tenantId) ?? []
        list.push({ name: p.name as string, expiry_date: p.expiry_date as string })
        byTenant.set(tenantId, list)
      }
      for (const [tenantId, items] of byTenant) {
        const first = items[0]
        if (!first) continue
        const extra = items.length > 1 ? ` (+${items.length - 1} more)` : ''
        notifyPharmacyStock({
          tenantId,
          productName: first.name,
          reason: 'expiry',
          detail: `${first.name} expires ${first.expiry_date}${extra}.`,
        })
        stockPushes += 1
      }
    }
  }

  return NextResponse.json({
    ok: true,
    appointmentPushes,
    stockPushes,
    window: { from, to, expiryCutoff },
  })
}
