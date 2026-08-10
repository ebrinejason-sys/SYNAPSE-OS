import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  isMobilePharmacyAdmin,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

function mapSettings(settings: Record<string, unknown>) {
  return {
    id: settings.id,
    tenantId: settings.tenant_id,
    pharmacyName: settings.pharmacy_name ?? '',
    location: settings.location ?? '',
    contact: settings.contact ?? '',
    email: settings.email ?? '',
    footerText: settings.footer_text ?? '',
    receiptHeader: settings.receipt_header ?? '',
    receiptFooter: settings.receipt_footer ?? '',
    currency: settings.currency ?? 'UGX',
    taxRate: settings.tax_rate ?? 0,
    lowStockThreshold: settings.low_stock_threshold ?? 10,
  }
}

/** GET — pharmacy settings for the authenticated tenant. */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const { data: settings, error } = await db()
    .from('pharmacy_settings')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('[mobile/pharmacy/settings GET]', error.message)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }

  if (!settings) {
    return NextResponse.json({
      settings: {
        pharmacyName: '',
        receiptHeader: '',
        receiptFooter: '',
        currency: 'UGX',
        lowStockThreshold: 10,
      },
    })
  }

  return NextResponse.json({ settings: mapSettings(settings as Record<string, unknown>) })
}

/** PATCH — limited fields (receipt header/footer, pharmacy name) for admins. */
export async function PATCH(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  if (!isMobilePharmacyAdmin(auth)) {
    return NextResponse.json({ error: 'Admin permission required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    pharmacyName?: string
    receiptHeader?: string
    receiptFooter?: string
  } | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.pharmacyName === 'string') update.pharmacy_name = body.pharmacyName.trim()
  if (typeof body.receiptHeader === 'string') update.receipt_header = body.receiptHeader
  if (typeof body.receiptFooter === 'string') update.receipt_footer = body.receiptFooter

  if (Object.keys(update).length <= 1) {
    return NextResponse.json(
      { error: 'Provide pharmacyName, receiptHeader, and/or receiptFooter' },
      { status: 400 },
    )
  }

  const { data: existing } = await db()
    .from('pharmacy_settings')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .maybeSingle()

  let settings: Record<string, unknown> | null = null
  if (existing) {
    const { data, error } = await db()
      .from('pharmacy_settings')
      .update(update)
      .eq('tenant_id', auth.tenantId)
      .select('*')
      .single()
    if (error) {
      console.error('[mobile/pharmacy/settings PATCH]', error.message)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }
    settings = data
  } else {
    const { data, error } = await db()
      .from('pharmacy_settings')
      .insert({
        tenant_id: auth.tenantId,
        pharmacy_name: typeof body.pharmacyName === 'string' ? body.pharmacyName.trim() : '',
        receipt_header: typeof body.receiptHeader === 'string' ? body.receiptHeader : '',
        receipt_footer: typeof body.receiptFooter === 'string' ? body.receiptFooter : '',
      })
      .select('*')
      .single()
    if (error) {
      console.error('[mobile/pharmacy/settings PATCH insert]', error.message)
      return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 })
    }
    settings = data
  }

  await db().from('pharmacy_audit_logs').insert({
    tenant_id: auth.tenantId,
    profile_id: auth.userId,
    action: 'UPDATE_SETTINGS',
    entity: 'SETTINGS',
    entity_id: settings?.id ?? auth.tenantId,
    details: 'Updated pharmacy settings (mobile)',
  })

  return NextResponse.json({
    ok: true,
    settings: mapSettings(settings as Record<string, unknown>),
  })
}
