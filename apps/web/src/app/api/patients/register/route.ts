import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, patientRegisterSchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

const MAX_MRN_ATTEMPTS = 3

function generateMrn(hospitalId: string): string {
  const shortId = hospitalId.replace(/-/g, '').slice(0, 4).toUpperCase()
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = randomBytes(4).toString('hex').toUpperCase()
  return `${shortId}-${stamp}-${rand}`
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

  let data: { id: string; mrn: string; full_name: string; dob: string; sex: string } | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let error: any = null

  for (let attempt = 1; attempt <= MAX_MRN_ATTEMPTS; attempt++) {
    const row = {
      ...parsed.data,
      tenant_id: ctx.tenantId,
      hospital_id: ctx.hospitalId,
      mrn: generateMrn(ctx.hospitalId),
      is_deleted: false,
      created_by: ctx.userId,
    }

    const result = await db
      .from('patients')
      .insert(row)
      .select('id, mrn, full_name, dob, sex')
      .single()

    data = result.data
    error = result.error

    if (!error) break
    if (error.code !== '23505' || attempt === MAX_MRN_ATTEMPTS) break
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Registration failed' }, { status: 500 })

  let person: { id: string; synapseId: string } | null = null
  try {
    const { registerPersonForFacility } = await import('@synapse/db/identity-persist')
    const names = parsed.data.full_name.trim().split(/\s+/)
    person = await registerPersonForFacility({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      localMrn: data.mrn,
      sourceSystem: 'synapse-hospital-registration',
      demographics: {
        givenName: names[0],
        familyName: names.slice(1).join(' ') || names[0],
        fullName: parsed.data.full_name,
        dateOfBirth: parsed.data.dob,
        sex: parsed.data.sex,
      },
    })
    if (person) {
      await db.from('patients').update({ person_id: person.id }).eq('id', data.id).eq('tenant_id', ctx.tenantId)
    }
  } catch (error) {
    console.error('[patients/register] person link failed', error)
  }

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'patients',
    recordId: data.id,
    newValue: data,
  })

  return NextResponse.json({ patient: { ...data, person_id: person?.id ?? null, synapse_id: person?.synapseId ?? null } }, { status: 201 })
}
