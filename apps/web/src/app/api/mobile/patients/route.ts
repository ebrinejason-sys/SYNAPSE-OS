import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  if (!payload.tenant_id) return NextResponse.json({ patients: [] })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('patients')
    .select('id, full_name, mrn, date_of_birth, sex, created_at')
    .eq('tenant_id', payload.tenant_id)
    .eq('is_deleted', false)
    .order('full_name', { ascending: true })
    .limit(limit)

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,mrn.ilike.%${q}%`)
  }

  const { data: patients, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to load patients' }, { status: 500 })
  }

  return NextResponse.json({
    patients: (patients ?? []).map((p: {
      id: string; full_name: string; mrn: string | null;
      date_of_birth: string | null; sex: string | null; created_at: string
    }) => ({
      id: p.id,
      fullName: p.full_name,
      mrn: p.mrn,
      dateOfBirth: p.date_of_birth,
      sex: p.sex,
      createdAt: p.created_at,
    })),
  })
}
