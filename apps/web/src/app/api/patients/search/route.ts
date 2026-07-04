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

  // Two separate fluent queries instead of a single raw `.or()` filter string.
  // PostgREST's or= DSL splits on unescaped commas and treats `.` as a
  // separator, so building it via string interpolation is unsafe for
  // arbitrary user input (e.g. a name containing a comma). Using the query
  // builder's `.ilike()` per-column avoids that escaping problem entirely.
  const [byName, byMrn] = await Promise.all([
    db
      .from('patients')
      .select('id, full_name, mrn')
      .eq('tenant_id', ctx.tenantId)
      .eq('is_deleted', false)
      .ilike('full_name', `%${q}%`)
      .order('full_name', { ascending: true })
      .limit(limit),
    db
      .from('patients')
      .select('id, full_name, mrn')
      .eq('tenant_id', ctx.tenantId)
      .eq('is_deleted', false)
      .ilike('mrn', `%${q}%`)
      .order('full_name', { ascending: true })
      .limit(limit),
  ])

  if (byName.error) return NextResponse.json({ error: byName.error.message }, { status: 500 })
  if (byMrn.error) return NextResponse.json({ error: byMrn.error.message }, { status: 500 })

  const merged = new Map<string, { id: string; full_name: string; mrn: string | null }>()
  for (const p of [...(byName.data ?? []), ...(byMrn.data ?? [])]) {
    if (!merged.has(p.id)) merged.set(p.id, p)
  }

  const patients = Array.from(merged.values())
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .slice(0, limit)

  return NextResponse.json({
    patients: patients.map((p) => ({
      id: p.id,
      fullName: p.full_name,
      mrn: p.mrn,
    })),
  })
}
