import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  let tenantId = user.tenantId ?? null
  if (!tenantId) {
    const { data: profile } = await db
      .from('profiles')
      .select('tenant_id, hospital_id')
      .eq('id', user.id)
      .single() as { data: { tenant_id: string | null; hospital_id: string | null } | null }
    tenantId = profile?.tenant_id ?? profile?.hospital_id ?? null
  }
  if (!tenantId) return NextResponse.json({ drugs: [] })

  const { data, error } = await db
    .from('drug_inventory')
    .select('id, generic_name, brand_name, formulation, strength, quantity_in_stock, reorder_level, unit_price_ugx, expiry_date, category')
    .eq('tenant_id', tenantId)
    .order('generic_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ drugs: data ?? [] })
}
