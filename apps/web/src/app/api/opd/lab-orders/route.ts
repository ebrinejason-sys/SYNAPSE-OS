import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { recordLabOrderPlaced } from '@synapse/db/clinical-journey'
import { persistLabOrderBestEffort } from '@synapse/db/lab-order-persist'
import { labOrderTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import { appendClinicalChargeBestEffort, recordInvoiceCreatedEvent, resolveServicePrice } from '@synapse/db/clinical-charge'
import { persistDomainEventsBestEffort, persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '../../../../lib/hospital-shared'
import { requireHospitalStaffContext, labOrderCreateSchema } from '../../../../lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'order', 'read', 'lab')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'lab')
  if (moduleBlock) return moduleBlock

  const encounterId = req.nextUrl.searchParams.get('encounter_id')
  const status = req.nextUrl.searchParams.get('status')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  let query = db
    .from('lab_orders')
    .select(
      'id, tenant_id, encounter_id, patient_id, person_id, loinc_code, test_name, urgency, status, workflow_status, ordered_by, ordered_at, correlation_id, care_plan_id, accession_number, is_synthetic, replaces_lab_order_id, created_at',
    )
    .eq('tenant_id', ctx.tenantId)
    .order('ordered_at', { ascending: false })
    .limit(100)

  if (encounterId) {
    query = query.eq('encounter_id', encounterId)
  }
  if (status) {
    query = query.eq('workflow_status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ orders: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'order', 'create', 'lab')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'lab')
  if (moduleBlock) return moduleBlock

  const body = await req.json().catch(() => null)
  const parsed = labOrderCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { encounter_id, patient_id, loinc_code, test_name, urgency, care_plan_id, person_id, replaces_lab_order_id } = parsed.data

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
  let orderId = crypto.randomUUID()
  let labTaskId: string | undefined
  let correlationId = encounter_id

  try {
    const journey = recordLabOrderPlaced({
      tenantId: ctx.tenantId,
      hospitalId: ctx.hospitalId,
      patientId: patient_id,
      personId: person_id ?? null,
      encounterId: encounter_id,
      carePlanId: care_plan_id ?? null,
      requesterId: ctx.userId,
      loincCode: loinc_code,
      testName: test_name,
      urgency: urgency ?? 'ROUTINE',
      orderId,
      correlationId: encounter_id,
    })

    orderId = journey.order.id
    labTaskId = journey.labTask.id
    correlationId = journey.correlationId

    if (replaces_lab_order_id) {
      const { data: prior, error: priorError } = await db
        .from('lab_orders')
        .select('id, workflow_status, patient_id, encounter_id')
        .eq('id', replaces_lab_order_id)
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle()
      if (priorError) return NextResponse.json({ error: priorError.message }, { status: 500 })
      if (!prior) return NextResponse.json({ error: 'Replaced lab order not found' }, { status: 404 })
      if (prior.patient_id !== patient_id || prior.encounter_id !== encounter_id) {
        return NextResponse.json({ error: 'Replacement must share patient and encounter' }, { status: 400 })
      }
      if (String(prior.workflow_status) !== 'REJECTED') {
        return NextResponse.json({ error: 'Replacement only allowed for REJECTED orders' }, { status: 400 })
      }
      const { data: openReplacement, error: openError } = await db
        .from('lab_orders')
        .select('id')
        .eq('tenant_id', ctx.tenantId)
        .eq('replaces_lab_order_id', replaces_lab_order_id)
        .not('workflow_status', 'in', '(CANCELLED,REJECTED,RELEASED,AMENDED)')
        .limit(1)
        .maybeSingle()
      if (openError) return NextResponse.json({ error: openError.message }, { status: 500 })
      if (openReplacement) {
        return NextResponse.json(
          { error: 'Open replacement already exists for this rejected order', existingOrderId: openReplacement.id },
          { status: 409 },
        )
      }
      journey.order.replacesLabOrderId = replaces_lab_order_id
    }

    const persistOrder = await persistLabOrderBestEffort(db, journey.order)
    const persistQueue = await persistWorkQueueArtifactsBestEffort(db, {
      tasks: [journey.labTask],
      events: journey.queue.outbox.list({ correlationId: journey.correlationId }),
    })

    if (!persistOrder.ok) journeyWarnings.push(persistOrder.error)
    if (persistQueue.errors.length) journeyWarnings.push(...persistQueue.errors)
    if (journeyWarnings.length) {
      console.warn('[opd/lab-orders] journey persist partial', journeyWarnings)
    }
    void publishClinicalTimelineBestEffort(
      publishTimelineEvent,
      labOrderTimelineEvent({
        tenantId: ctx.tenantId,
        hospitalId: ctx.hospitalId,
        patientId: patient_id,
        orderId,
        encounterId: encounter_id,
        testName: test_name,
        loincCode: loinc_code,
        createdBy: ctx.userId,
      }),
    )

    const unitPrice = await resolveServicePrice(db, ctx.tenantId, 'lab', test_name)
    const charge = await appendClinicalChargeBestEffort(db, {
      tenantId: ctx.tenantId,
      patientId: patient_id,
      encounterId: encounter_id,
      itemName: `Lab · ${test_name}`,
      unitPrice,
      sourceTable: 'lab_orders',
      sourceId: orderId,
      createdBy: ctx.userId,
    })
    if (!charge.ok) {
      journeyWarnings.push(charge.error)
    } else if (charge.result.created) {
      const outbox = recordInvoiceCreatedEvent({
        tenantId: ctx.tenantId,
        hospitalId: ctx.hospitalId,
        patientId: patient_id,
        encounterId: encounter_id,
        invoiceId: charge.result.invoiceId,
        totalAmount: charge.result.totalAmount,
        actorId: ctx.userId,
      })
      await persistDomainEventsBestEffort(db, outbox.list({ correlationId: encounter_id }))
    }
  } catch (error) {
    console.warn('[opd/lab-orders] clinical journey step failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lab order journey failed' },
      { status: 500 },
    )
  }

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'lab_orders',
    recordId: orderId,
    newValue: { encounter_id, patient_id, loinc_code, test_name, urgency: urgency ?? 'ROUTINE' },
  })

  const response: {
    orderId: string
    labTaskId?: string
    correlationId: string
    journeyWarnings?: string[]
  } = {
    orderId,
    correlationId,
  }
  if (labTaskId) response.labTaskId = labTaskId
  if (journeyWarnings.length) response.journeyWarnings = journeyWarnings

  return NextResponse.json(response, { status: 201 })
}
