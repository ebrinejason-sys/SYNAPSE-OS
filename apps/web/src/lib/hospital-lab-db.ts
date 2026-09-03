/**
 * Hospital lab worklist + actions backed by Postgres lab_orders / lab_results / lab_specimens.
 * LabWorkflow is the transition engine; Postgres is authoritative across requests.
 */

import { supabaseAdmin } from '@synapse/db/admin'
import { LabWorkflow, type LabOrder, type LabResult } from '@synapse/db/lab-workflow'
import { rowToLabOrder, persistLabOrderBestEffort } from '@synapse/db/lab-order-persist'
import {
  allocateAccessionNumber,
  loadLabResultsForOrder,
  persistCriticalAckBestEffort,
  persistLabResultBestEffort,
  persistLabSpecimenBestEffort,
} from '@synapse/db/lab-result-persist'
import { labResultReleasedTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import type { HospitalContext } from './hospital-shared'

type DbClient = typeof supabaseAdmin

export type HospitalLabWorklistOrder = {
  id: string
  tenantId: string
  patientId: string
  encounterId: string
  loincCode: string
  testName: string
  urgency: string
  status: string
  accessionNumber: string | null
  orderedAt: string
  patientName: string | null
  synapseId: string | null
  hasResult?: boolean
  resultValue?: string | null
  isCritical?: boolean
}

export async function fetchHospitalLabWorklist(
  ctx: HospitalContext,
  filters?: { encounterId?: string | null; status?: string | null },
): Promise<{ orders: HospitalLabWorklistOrder[]; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  let query = db
    .from('lab_orders')
    .select(
      'id, tenant_id, encounter_id, patient_id, loinc_code, test_name, urgency, status, workflow_status, accession_number, ordered_at, patients(first_name, last_name, mrn)',
    )
    .eq('tenant_id', ctx.tenantId)
    .eq('is_synthetic', false)
    .order('ordered_at', { ascending: false })
    .limit(100)

  if (filters?.encounterId) query = query.eq('encounter_id', filters.encounterId)
  if (filters?.status) query = query.eq('workflow_status', filters.status)

  const { data, error } = await query
  if (error) return { orders: [], error: error.message }

  const orderIds = (data ?? []).map((row: Record<string, unknown>) => String(row.id))
  const resultByOrder = new Map<string, { value: string; isCritical: boolean }>()
  if (orderIds.length) {
    const { data: results } = await db
      .from('lab_results')
      .select('lab_order_id, result_value, is_critical')
      .eq('tenant_id', ctx.tenantId)
      .in('lab_order_id', orderIds)
    for (const row of results ?? []) {
      resultByOrder.set(String(row.lab_order_id), {
        value: String(row.result_value),
        isCritical: Boolean(row.is_critical),
      })
    }
  }

  const orders: HospitalLabWorklistOrder[] = (data ?? []).map((row: Record<string, unknown>) => {
    const patient = row.patients as { first_name?: string; last_name?: string; mrn?: string } | null
    const patientName = patient
      ? [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim() || null
      : null
    const id = String(row.id)
    const prior = resultByOrder.get(id)
    return {
      id,
      tenantId: String(row.tenant_id),
      patientId: String(row.patient_id),
      encounterId: String(row.encounter_id),
      loincCode: String(row.loinc_code ?? ''),
      testName: String(row.test_name),
      urgency: String(row.urgency),
      status: String(row.workflow_status ?? row.status ?? 'ORDERED'),
      accessionNumber: (row.accession_number as string | null) ?? null,
      orderedAt: String(row.ordered_at),
      patientName,
      synapseId: patient?.mrn ?? null,
      hasResult: Boolean(prior),
      resultValue: prior?.value ?? null,
      isCritical: prior?.isCritical ?? false,
    }
  })

  return { orders }
}

async function loadLabOrder(db: DbClient, tenantId: string, orderId: string): Promise<LabOrder | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = db as any
  const { data, error } = await client
    .from('lab_orders')
    .select('*')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error || !data) return null
  return rowToLabOrder(data as Record<string, unknown>)
}

export async function executeHospitalLabAction(params: {
  ctx: HospitalContext
  orderId: string
  action: string
  actorId: string
  extra?: Record<string, unknown>
}): Promise<{ order: LabOrder; result: LabResult | null; warnings: string[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const order = await loadLabOrder(supabaseAdmin, params.ctx.tenantId, params.orderId)
  if (!order) throw new Error('LAB_ORDER_NOT_FOUND')

  const priorResults = await loadLabResultsForOrder(db, params.ctx.tenantId, params.orderId)
  const lab = new LabWorkflow([order], priorResults)
  const warnings: string[] = []
  let result: LabResult | null = null
  let enteredBy: string | null = null
  let resultSource = 'MANUAL'

  if (params.action === 'collect') {
    const accession =
      typeof params.extra?.accessionNumber === 'string' && params.extra.accessionNumber.trim()
        ? String(params.extra.accessionNumber).trim()
        : await allocateAccessionNumber(db, params.ctx.tenantId, 'HOSP')
    const specimenId = crypto.randomUUID()
    const barcode = accession.replace(/[^A-Z0-9-]/gi, '')
    lab.collect(params.orderId, accession, barcode, specimenId)
    const specimenPersist = await persistLabSpecimenBestEffort(db, {
      id: specimenId,
      tenantId: order.tenantId,
      patientId: order.patientId,
      personId: order.personId,
      encounterId: order.encounterId,
      labOrderId: order.id,
      accessionNumber: accession,
      barcode,
      specimenType: typeof params.extra?.specimenType === 'string' ? params.extra.specimenType : 'blood',
      collectedBy: params.actorId,
    })
    if (!specimenPersist.ok) warnings.push(specimenPersist.error)
  } else if (params.action === 'receive') {
    lab.receive(params.orderId)
    if (order.specimenId) {
      await db
        .from('lab_specimens')
        .update({ status: 'in_lab', received_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', order.specimenId)
        .eq('tenant_id', params.ctx.tenantId)
    }
  } else if (params.action === 'reject') {
    lab.reject(params.orderId, 'other', String(params.extra?.reason ?? 'rejected'))
    if (order.specimenId) {
      await db
        .from('lab_specimens')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', order.specimenId)
        .eq('tenant_id', params.ctx.tenantId)
    }
  } else if (params.action === 'enter_result') {
    enteredBy = params.actorId
    resultSource = typeof params.extra?.source === 'string' ? String(params.extra.source) : 'MANUAL'
    const entered = lab.enterResult({
      resultId: priorResults[0]?.id ?? crypto.randomUUID(),
      orderId: params.orderId,
      value: String(params.extra?.value ?? ''),
      analyzer: typeof params.extra?.analyzer === 'string' ? params.extra.analyzer : 'manual',
    })
    result = entered.result
  } else if (params.action === 'verify') {
    result = lab.verify(params.orderId, params.actorId)
  } else if (params.action === 'release') {
    result = lab.release(params.orderId)
  } else if (params.action === 'acknowledge') {
    const ackResult =
      lab.snapshot().results.find((row) => row.labOrderId === params.orderId) ?? priorResults[0] ?? null
    lab.acknowledgeCritical({
      id: crypto.randomUUID(),
      orderId: params.orderId,
      acknowledgedBy: params.actorId,
      note: String(params.extra?.note ?? 'acknowledged'),
    })
    if (ackResult) {
      const ackPersist = await persistCriticalAckBestEffort(db, {
        tenantId: params.ctx.tenantId,
        resultId: ackResult.id,
        labOrderId: params.orderId,
        patientId: order.patientId,
        acknowledgedBy: params.actorId,
        note: String(params.extra?.note ?? 'acknowledged'),
      })
      if (!ackPersist.ok) warnings.push(ackPersist.error)
    }
  } else {
    throw new Error('Unknown action')
  }

  const updated = lab.getOrder(params.orderId)
  const persist = await persistLabOrderBestEffort(db, updated)
  if (!persist.ok) warnings.push(persist.error)

  if (!result) {
    result = lab.snapshot().results.find((row) => row.labOrderId === params.orderId) ?? null
  }

  if (result) {
    const resultPersist = await persistLabResultBestEffort(db, result, {
      enteredBy,
      source: resultSource,
    })
    if (!resultPersist.ok) warnings.push(resultPersist.error)
  }

  if (params.action === 'release') {
    const { error } = await db
      .from('department_tasks')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('tenant_id', params.ctx.tenantId)
      .eq('source_resource', 'lab_orders')
      .eq('source_id', params.orderId)
      .eq('task_type', 'lab_order')
    if (error) warnings.push(error.message)

    if (result) {
      void publishClinicalTimelineBestEffort(
        publishTimelineEvent,
        labResultReleasedTimelineEvent({
          tenantId: params.ctx.tenantId,
          hospitalId: params.ctx.hospitalId,
          patientId: updated.patientId,
          orderId: params.orderId,
          encounterId: updated.encounterId,
          testName: updated.testName,
          resultValue: result.resultValue,
          releasedBy: params.actorId,
        }),
      )
    }
  }

  return { order: updated, result, warnings }
}
