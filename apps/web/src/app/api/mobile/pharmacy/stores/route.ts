import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/** Tenant-scoped store list for branch transfer pickers. */
export async function GET(request: NextRequest) {
  const auth = await requireMobilePharmacyAuth(request)
  if (!isMobileAuth(auth)) return auth

  const { data, error } = await db()
    .from('pharmacy_stores')
    .select('id, name, store_type, is_active')
    .eq('tenant_id', auth.tenantId)
    .order('name')

  if (error) {
    if (String(error.message).toLowerCase().includes('does not exist')) {
      return NextResponse.json({ stores: [] })
    }
    return NextResponse.json({ error: 'Unable to load stores' }, { status: 500 })
  }

  return NextResponse.json({
    stores: (data ?? []).filter((row: { is_active?: boolean }) => row.is_active !== false),
  })
}
