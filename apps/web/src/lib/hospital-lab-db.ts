/**
 * Hospital lab worklist + actions backed by Postgres lab_orders.
 */

import { supabaseAdmin } from '@synapse/db/admin'
import { LabWorkflow, type LabOrder, type LabResult } from '@synapse/db/lab-workflow'
import { rowToLabOrder, persistLabOrderBestEffort } from '@synapse/db/lab-order-persist'
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

  const orders: HospitalLabWorklistOrder[] = (data ?? []).map((row: Record<string, unknown>) => {
    const patient = row.patients as { first_name?: string; last_name?: string; mrn?: string } | null
    const patientName = patient
      ? [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim() || null
      : null
    return {
      id: String(row.id),
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

  const lab = new LabWorkflow([order])
  const warnings: string[] = []
  let result: LabResult | null = null

  if (params.action === 'collect') {
    const accession = String(params.extra?.accessionNumber ?? `HOSP-${Date.now()}`)
    lab.collect(params.orderId, accession, accession.replace(/[^A-Z0-9]/gi, ''), crypto.randomUUID())
  } else if (params.action === 'receive') {
    lab.receive(params.orderId)
  } else if (params.action === 'reject') {
    lab.reject(params.orderId, 'other', String(params.extra?.reason ?? 'rejected'))
  } else if (params.action === 'enter_result') {
    const entered = lab.enterResult({
      resultId: crypto.randomUUID(),
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
    lab.acknowledgeCritical({
      id: crypto.randomUUID(),
      orderId: params.orderId,
      acknowledgedBy: params.actorId,
      note: String(params.extra?.note ?? 'acknowledged'),
    })
  } else {
    throw new Error('Unknown action')
  }

  const updated = lab.getOrder(params.orderId)
  const persist = await persistLabOrderBestEffort(db, updated)
  if (!persist.ok) warnings.push(persist.error)

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

  if (!result) {
    result = lab.snapshot().results.find((row) => row.labOrderId === params.orderId) ?? null
  }

  return { order: updated, result, warnings }
}
