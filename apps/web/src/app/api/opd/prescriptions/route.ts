import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { recordPrescriptionPlaced } from '@synapse/db/clinical-journey'
import { persistClinicalPrescriptionBestEffort } from '@synapse/db/prescription-persist'
import { persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, prescriptionCreateSchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'prescription', 'read', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'dispensing')
  if (moduleBlock) return moduleBlock

  const encounterId = req.nextUrl.searchParams.get('encounter_id')
  const status = req.nextUrl.searchParams.get('status')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  let query = db
    .from('clinical_prescriptions')
    .select(
      'id, tenant_id, pharmacy_tenant_id, patient_id, encounter_id, medication_display, dose, quantity, unit, status, prescriber_id, correlation_id, is_synthetic, created_at',
    )
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (encounterId) query = query.eq('encounter_id', encounterId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ prescriptions: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'prescription', 'create', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'dispensing')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = prescriptionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const {
    encounter_id,
    patient_id,
    medication_display,
    dose,
    quantity,
    unit,
    care_plan_id,
    person_id,
    pharmacy_tenant_id,
  } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: encounterError } = await db
    .from('encounters')
    .select('id, patient_id, tenant_id')
    .eq('id', encounter_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (encounterError) return NextResponse.json({ error: encounterError.message }, { status: 500 })
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  if (encounter.patient_id !== patient_id) {
    return NextResponse.json({ error: 'Patient does not match encounter' }, { status: 400 })
  }

  let journeyWarnings: string[] = []
  let prescriptionId = crypto.randomUUID()
  let pharmacyTaskId: string | undefined
  let correlationId = encounter_id

  try {
    const journey = recordPrescriptionPlaced({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: patient_id,
      personId: person_id ?? null,
      encounterId: encounter_id,
      carePlanId: care_plan_id ?? null,
      requesterId: ctx.userId,
      medicationDisplay: medication_display,
      dose,
      quantity,
      unit,
      pharmacyTenantId: pharmacy_tenant_id ?? null,
      prescriptionId,
      correlationId: encounter_id,
    })

    prescriptionId = journey.prescription.id
    pharmacyTaskId = journey.pharmacyTask.id
    correlationId = journey.correlationId

    const persistRx = await persistClinicalPrescriptionBestEffort(db, journey.prescription)
    const persistQueue = await persistWorkQueueArtifactsBestEffort(db, {
      tasks: [journey.pharmacyTask],
      events: journey.queue.outbox.list({ correlationId: journey.correlationId }),
    })

    if (!persistRx.ok) journeyWarnings.push(persistRx.error)
    if (persistQueue.errors.length) journeyWarnings.push(...persistQueue.errors)
    if (journeyWarnings.length) {
      console.warn('[opd/prescriptions] journey persist partial', journeyWarnings)
    }
  } catch (error) {
    console.warn('[opd/prescriptions] clinical journey step failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Prescription journey failed' },
      { status: 500 },
    )
  }

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'clinical_prescriptions',
    recordId: prescriptionId,
    newValue: { encounter_id, patient_id, medication_display, dose, quantity },
  })

  const response: {
    prescriptionId: string
    pharmacyTaskId?: string
    correlationId: string
    journeyWarnings?: string[]
  } = {
    prescriptionId,
    correlationId,
  }
  if (pharmacyTaskId) response.pharmacyTaskId = pharmacyTaskId
  if (journeyWarnings.length) response.journeyWarnings = journeyWarnings

  return NextResponse.json(response, { status: 201 })
}
