import { NextRequest, NextResponse } from 'next/server'
import { requirePharmacyTenant } from "@/lib/api-auth"
import { supabaseAdmin } from '@synapse/db/admin'

// GET /api/onboarding — fetch all pre-filled data for the wizard
export async function GET() {
  const auth = await requirePharmacyTenant()
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  const db = supabaseAdmin as any

  const [
    { data: tenant },
    { data: profile },
    { data: onboarding },
    { data: store },
  ] = await Promise.all([
    db.from('tenants').select('name,address,district,phone').eq('id', tenantId).single(),
    db.from('pharmacy_profiles')
      .select('license_number,license_expiry,contact_phone,physical_address,district')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    db.from('pharmacy_onboarding').select('current_step').eq('tenant_id', tenantId).maybeSingle(),
    db.from('pharmacy_stores').select('id,name,store_type').eq('tenant_id', tenantId).maybeSingle(),
  ])

  return NextResponse.json({
    tenantId,
    tenantName: tenant?.name ?? '',
    address: profile?.physical_address ?? tenant?.address ?? '',
    district: profile?.district ?? tenant?.district ?? '',
    phone: profile?.contact_phone ?? tenant?.phone ?? '',
    licenseNumber: profile?.license_number ?? '',
    licenseExpiry: profile?.license_expiry ?? '',
    currentStep: onboarding?.current_step ?? 1,
    storeName: store?.name ?? (tenant?.name ? `${tenant.name} - Main Branch` : ''),
    storeType: store?.store_type ?? 'main',
  })
}

// POST /api/onboarding — save a wizard step
export async function POST(req: NextRequest) {
  const auth = await requirePharmacyTenant()
  if (!auth.ok) return auth.response
  const { session, tenantId } = auth

  const body = await req.json()
  const { step, data } = body as { step: number; data: Record<string, unknown> }
  const db = supabaseAdmin as any

  try {
    if (step === 1) {
      await db.from('tenants').update({
        address: data.address,
        district: data.district,
        phone: data.phone,
      }).eq('id', tenantId)

      await db.from('pharmacy_profiles').upsert({
        tenant_id: tenantId,
        license_number: data.licenseNumber || null,
        license_expiry: data.licenseExpiry || null,
        contact_phone: data.phone || null,
        physical_address: data.address || null,
        district: data.district || null,
      }, { onConflict: 'tenant_id' })

      await db.from('pharmacy_onboarding').update({ current_step: 2 }).eq('tenant_id', tenantId)
      return NextResponse.json({ nextStep: 2 })
    }

    if (step === 2) {
      const storeTypeRaw = String(data.storeType ?? 'main').toLowerCase()
      const storeType =
        storeTypeRaw === 'main branch' || storeTypeRaw === 'main'
          ? 'main'
          : storeTypeRaw === 'dispensary'
            ? 'dispensary'
            : storeTypeRaw === 'satellite'
              ? 'satellite'
              : 'main'

      const { data: existing } = await db.from('pharmacy_stores')
        .select('id').eq('tenant_id', tenantId).maybeSingle()

      if (!existing) {
        await db.from('pharmacy_stores').insert({
          tenant_id: tenantId,
          name: data.storeName,
          store_type: storeType,
          is_active: true,
        })
      }

      await db.from('pharmacy_onboarding').update({ current_step: 3 }).eq('tenant_id', tenantId)
      return NextResponse.json({ nextStep: 3 })
    }

    if (step === 3) {
      const rows = (data.products as Array<{ name: string; category: string; quantity: string; price: string; reorderLevel: string }> ?? [])
        .filter(p => p.name?.trim())

      if (rows.length > 0) {
        const inserts = rows.map((row, idx) => ({
          tenant_id: tenantId,
          name: row.name.trim(),
          category: row.category.trim() || 'General',
          quantity: 0,
          price: parseFloat(row.price) || 0,
          reorder_level: parseInt(row.reorderLevel) || 5,
          is_active: true,
          sku: `SKU-${row.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}-${Date.now()}-${idx}`,
          cost_price: parseFloat(row.price) || 0,
          unit_of_measure: 'units',
        }))
        await db.from('pharmacy_products').insert(inserts)
      }

      await db.from('pharmacy_onboarding').update({ current_step: 4 }).eq('tenant_id', tenantId)
      return NextResponse.json({ nextStep: 4 })
    }

    if (step === 4) {
      const update: Record<string, unknown> = {
        is_network_member: data.isNetworkMember,
        accepts_refill_requests: data.acceptsRefillRequests,
      }
      if (data.isNetworkMember && data.networkListingName) {
        update.network_listing_name = data.networkListingName
      }
      await db.from('tenants').update(update).eq('id', tenantId)
      await db.from('pharmacy_onboarding').update({ current_step: 5 }).eq('tenant_id', tenantId)
      return NextResponse.json({ nextStep: 5 })
    }

    if (step === 5) {
      await db.from('tenants').update({ onboarding_completed: true }).eq('id', tenantId)
      await db.from('pharmacy_onboarding').update({ 
        current_step: 5,
        onboarding_completed_at: new Date().toISOString()
      }).eq('tenant_id', tenantId)
      return NextResponse.json({ nextStep: 'dashboard' })
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
  } catch (err) {
    console.error('[onboarding] step', step, 'error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Save failed' }, { status: 500 })
  }
}
