import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, patientRegisterSchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

function generateMrn(hospitalId: string): string {
  const shortId = hospitalId.replace(/-/g, '').slice(0, 4).toUpperCase()
  const stamp = Date.now().toString(36).toUpperCase()
  return `${shortId}-${stamp}`
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'patient', 'register', 'registration')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'registration')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = patientRegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const row = {
    ...parsed.data,
    tenant_id: ctx.tenantId,
    hospital_id: ctx.hospitalId,
    mrn: generateMrn(ctx.hospitalId),
    is_deleted: false,
    created_by: ctx.userId,
  }

  const { data, error } = await db
    .from('patients')
    .insert(row)
    .select('id, mrn, full_name, dob, sex')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'patients',
    recordId: data.id,
    newValue: data,
  })

  return NextResponse.json({ patient: data }, { status: 201 })
}
