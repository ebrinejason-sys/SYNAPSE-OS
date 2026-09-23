import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/**
 * Native pharmacy onboarding — mirrors the pharmacy portal `/api/onboarding` contract so a
 * new pharmacy can finish setup entirely in the app. Intentionally NOT subscription-gated
 * (onboarding must work before a plan is active).
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  const tenantId = auth.tenantId

  const [{ data: tenant }, { data: profile }, { data: onboarding }, { data: store }] =
    await Promise.all([
      db().from('tenants').select('name,address,district,phone,onboarding_completed').eq('id', tenantId).maybeSingle(),
      db()
        .from('pharmacy_profiles')
        .select('license_number,license_expiry,contact_phone,physical_address,district')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      db().from('pharmacy_onboarding').select('current_step').eq('tenant_id', tenantId).maybeSingle(),
      db().from('pharmacy_stores').select('id,name,store_type').eq('tenant_id', tenantId).maybeSingle(),
    ])

  const currentStep = onboarding?.current_step ?? 1

  return NextResponse.json({
    tenantId,
    tenantName: tenant?.name ?? '',
    address: profile?.physical_address ?? tenant?.address ?? '',
    district: profile?.district ?? tenant?.district ?? '',
    phone: profile?.contact_phone ?? tenant?.phone ?? '',
    licenseNumber: profile?.license_number ?? '',
    licenseExpiry: profile?.license_expiry ?? '',
    currentStep,
    completed: currentStep >= 5 || Boolean(tenant?.onboarding_completed),
    storeName: store?.name ?? (tenant?.name ? `${tenant.name} - Main Branch` : ''),
    storeType: store?.store_type ?? 'main',
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth
  const tenantId = auth.tenantId

  const body = (await req.json().catch(() => null)) as { step?: number; data?: Record<string, unknown> } | null
  if (!body || typeof body.step !== 'number') {
    return NextResponse.json({ error: 'step is required' }, { status: 400 })
  }
  const step = body.step
  const data = body.data ?? {}

  try {
    if (step === 1) {
      await db().from('tenants').update({ address: data.address, district: data.district, phone: data.phone }).eq('id', tenantId)
      await db()
        .from('pharmacy_profiles')
        .upsert(
          {
            tenant_id: tenantId,
            license_number: data.licenseNumber || null,
            license_expiry: data.licenseExpiry || null,
            contact_phone: data.phone || null,
            physical_address: data.address || null,
            district: data.district || null,
          },
          { onConflict: 'tenant_id' },
        )
      await db().from('pharmacy_onboarding').update({ current_step: 2 }).eq('tenant_id', tenantId)
      return NextResponse.json({ nextStep: 2 })
    }

    if (step === 2) {
      const raw = String(data.storeType ?? 'main').toLowerCase()
      const storeType =
        raw === 'main branch' || raw === 'main'
          ? 'main'
          : raw === 'dispensary'
            ? 'dispensary'
            : raw === 'satellite'
              ? 'satellite'
              : 'main'
      const { data: existing } = await db().from('pharmacy_stores').select('id').eq('tenant_id', tenantId).maybeSingle()
      if (!existing) {
        await db().from('pharmacy_stores').insert({ tenant_id: tenantId, name: data.storeName, store_type: storeType, is_active: true })
      }
      await db().from('pharmacy_onboarding').update({ current_step: 3 }).eq('tenant_id', tenantId)
      return NextResponse.json({ nextStep: 3 })
    }

    if (step === 3) {
      type ProductRow = { name?: string; category?: string; quantity?: string; price?: string; reorderLevel?: string }
      const rows = ((data.products as ProductRow[]) ?? []).filter((p) => String(p?.name ?? '').trim())
      if (rows.length > 0) {
        const inserts = rows.map((row, idx) => {
          const name = String(row.name ?? '').trim()
          const price = parseFloat(String(row.price ?? '')) || 0
          return {
            tenant_id: tenantId,
            name,
            category: String(row.category ?? '').trim() || 'General',
            quantity: 0,
            price,
            reorder_level: parseInt(String(row.reorderLevel ?? '')) || 5,
            is_active: true,
            sku: `SKU-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}-${Date.now()}-${idx}`,
            cost_price: price,
            unit_of_measure: 'units',
          }
        })
        await db().from('pharmacy_products').insert(inserts)
      }
      await db().from('pharmacy_onboarding').update({ current_step: 4 }).eq('tenant_id', tenantId)
      return NextResponse.json({ nextStep: 4 })
    }

    if (step === 4) {
      const update: Record<string, unknown> = {
        is_network_member: data.isNetworkMember,
        accepts_refill_requests: data.acceptsRefillRequests,
      }
      if (data.isNetworkMember && data.networkListingName) update.network_listing_name = data.networkListingName
      await db().from('tenants').update(update).eq('id', tenantId)
      await db().from('pharmacy_onboarding').update({ current_step: 5 }).eq('tenant_id', tenantId)
      return NextResponse.json({ nextStep: 5 })
    }

    if (step === 5) {
      await db().from('tenants').update({ onboarding_completed: true }).eq('id', tenantId)
      await db().from('pharmacy_onboarding').update({ 
        current_step: 5,
        onboarding_completed_at: new Date().toISOString()
      }).eq('tenant_id', tenantId)
      // Parity with the OTP redirect flag; ignored if the column is absent.
      try {
        await db().from('profiles').update({ onboarding_complete: true }).eq('id', auth.userId)
      } catch {
        /* non-fatal */
      }
      return NextResponse.json({ nextStep: 'dashboard' })
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
  } catch (err) {
    console.error('[mobile/pharmacy/onboarding] step', step, 'error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Save failed' }, { status: 500 })
  }
}
