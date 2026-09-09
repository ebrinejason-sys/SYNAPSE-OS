import { randomBytes, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@synapse/db/admin'
import { recordLabOrderPlaced } from '@synapse/db/clinical-journey'
import { persistLabOrderBestEffort } from '@synapse/db/lab-order-persist'
import { isContextError, gateHospitalModule, requireHospitalCapability, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

const referralOrderSchema = z.object({
  patientName: z.string().trim().min(2).max(200),
  dateOfBirth: z.string().date().optional().or(z.literal('')),
  sex: z.enum(['M', 'F']),
  phone: z.string().trim().max(30).optional(),
  testName: z.string().trim().min(2).max(500),
  loincCode: z.string().trim().min(1).max(40),
  urgency: z.enum(['STAT', 'URGENT', 'ROUTINE']).default('ROUTINE'),
  referralSource: z.string().trim().max(200).optional(),
})

export async function POST(request: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, 'order', 'create', 'lab')
  if (cap) return cap
  const labBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'lab')
  if (labBlock) return labBlock

  const parsed = referralOrderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const db = supabaseAdmin as any
  const shortFacility = ctx.hospitalId.replaceAll('-', '').slice(0, 4).toUpperCase()
  const mrn = `${shortFacility}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`
  const { data: patient, error: patientError } = await db.from('patients').insert({
    tenant_id: ctx.tenantId,
    hospital_id: ctx.hospitalId,
    mrn,
    full_name: parsed.data.patientName,
    dob: parsed.data.dateOfBirth || null,
    sex: parsed.data.sex,
    phone: parsed.data.phone || null,
    created_by: ctx.userId,
    is_deleted: false,
    is_synthetic: false,
    data_classification: 'production',
  }).select('id,mrn,full_name').single()
  if (patientError || !patient) return NextResponse.json({ error: patientError?.message ?? 'Patient registration failed.' }, { status: 500 })

  const encounterId = randomUUID()
  const correlationId = randomUUID()
  const { error: encounterError } = await db.from('encounters').insert({
    id: encounterId,
    tenant_id: ctx.tenantId,
    hospital_id: ctx.hospitalId,
    patient_id: patient.id,
    clinician_id: ctx.userId,
    created_by: ctx.userId,
    chief_complaint: `External laboratory referral: ${parsed.data.testName}`,
    metadata: { encounter_type: 'LAB_REFERRAL', referral_source: parsed.data.referralSource || null },
    correlation_id: correlationId,
    status: 'open',
    is_deleted: false,
    is_synthetic: false,
  })
  if (encounterError) {
    await db.from('patients').delete().eq('id', patient.id).eq('tenant_id', ctx.tenantId)
    return NextResponse.json({ error: encounterError.message }, { status: 500 })
  }

  const journey = recordLabOrderPlaced({
    tenantId: ctx.tenantId,
    hospitalId: ctx.hospitalId,
    patientId: patient.id,
    encounterId,
    requesterId: ctx.userId,
    loincCode: parsed.data.loincCode,
    testName: parsed.data.testName,
    urgency: parsed.data.urgency,
    correlationId,
  })
  const persisted = await persistLabOrderBestEffort(db, journey.order)
  if (!persisted.ok) {
    await db.from('encounters').delete().eq('id', encounterId).eq('tenant_id', ctx.tenantId)
    await db.from('patients').delete().eq('id', patient.id).eq('tenant_id', ctx.tenantId)
    return NextResponse.json({ error: persisted.error }, { status: 500 })
  }

  await logHospitalAudit({ ctx, action: 'INSERT', tableName: 'lab_orders', recordId: journey.order.id, newValue: { source: 'external_referral', patient_id: patient.id, encounter_id: encounterId, test_name: parsed.data.testName } })
  return NextResponse.json({ order: journey.order, patient }, { status: 201 })
}
