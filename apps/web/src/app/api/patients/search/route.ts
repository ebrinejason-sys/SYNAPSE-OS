import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '10'), 50)

  if (q.length < 2) return NextResponse.json({ patients: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: patients, error } = await db
    .from('patients')
    .select('id, full_name, mrn')
    .eq('tenant_id', ctx.tenantId)
    .eq('is_deleted', false)
    .or(`full_name.ilike.%${q}%,mrn.ilike.%${q}%`)
    .order('full_name', { ascending: true })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    patients: (patients ?? []).map((p: { id: string; full_name: string; mrn: string | null }) => ({
      id: p.id,
      fullName: p.full_name,
      mrn: p.mrn,
    })),
  })
}
