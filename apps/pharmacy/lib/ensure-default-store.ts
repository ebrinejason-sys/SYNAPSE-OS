import { supabaseAdmin } from '@/lib/supabase/admin'

/** Ensure every pharmacy tenant has at least one active store (required for POS). */
export async function ensureDefaultPharmacyStore(tenantId: string): Promise<{ created: boolean; storeId?: string }> {
  const { data: existing } = await supabaseAdmin
    .from('pharmacy_stores')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return { created: false, storeId: existing.id as string }
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle()

  const storeName = tenant?.name ? `${tenant.name} — Main Branch` : 'Main Branch'

  const { data: created, error } = await supabaseAdmin
    .from('pharmacy_stores')
    .insert({
      tenant_id: tenantId,
      name: storeName,
      store_type: 'Main Branch',
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error('[ensureDefaultPharmacyStore]', error)
    return { created: false }
  }

  return { created: true, storeId: created.id as string }
}
