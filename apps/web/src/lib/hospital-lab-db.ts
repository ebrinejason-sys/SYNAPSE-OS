/**
 * Hospital lab worklist + actions backed by Postgres lab_orders / lab_results / lab_specimens.
 * LabWorkflow is the transition engine; Postgres is authoritative across requests.
 */

import { supabaseAdmin } from '@synapse/db/admin'
import {
  LabWorkflow,
  SPECIMEN_REJECTION_REASONS,
  type LabOrder,
  type LabResult,
  type SpecimenRejectionReason,
} from '@synapse/db/lab-workflow'
import { rowToLabOrder, persistLabOrderBestEffort } from '@synapse/db/lab-order-persist'
import { WorkQueue } from '@synapse/db/work-queue'
import { rowToDepartmentTask, persistWorkQueueArtifactsBestEffort } from '@synapse/db/work-queue-persist'
import {
  allocateAccessionNumber,
  loadLabResultsForOrder,
  persistCriticalAckBestEffort,
  persistLabResultBestEffort,
  persistLabSpecimenBestEffort,
} from '@synapse/db/lab-result-persist'
import { labResultReleasedTimelineEvent, publishClinicalTimelineBestEffort } from '@synapse/db/clinical-timeline'
import { publishTimelineEvent } from '@synapse/db/identity-persist'
import { buildLabReportArtifact } from '@synapse/db/lab-report'
import { ExchangeOutbox } from '@synapse/db/exchange'
import { persistDomainEventsBestEffort } from '@synapse/db/work-queue-persist'
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
    // A retry must not allocate another specimen, reset its received status,
    // or rewrite a previously verified result through the common persist path.
    if (!['ORDERED', 'COLLECTION_PENDING', 'REJECTED', 'CANCELLED'].includes(order.status)) {
      if (!order.specimenId || !order.accessionNumber || !order.barcode) {
        throw new Error('LAB_COLLECT_RETRY_INCOMPLETE:specimen reconciliation required')
      }
      return { order, result: priorResults[0] ?? null, warnings }
    }
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
    const rawReason = String(params.extra?.reason ?? params.extra?.rejectionReason ?? 'other')
    const reason = (SPECIMEN_REJECTION_REASONS as readonly string[]).includes(rawReason)
      ? (rawReason as SpecimenRejectionReason)
      : ('other' as SpecimenRejectionReason)
    const note = String(params.extra?.note ?? params.extra?.rejectionNote ?? rawReason)
    lab.reject(params.orderId, reason, note)
    if (order.specimenId) {
      await db
        .from('lab_specimens')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          rejection_note: note,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.specimenId)
        .eq('tenant_id', params.ctx.tenantId)
    }
  } else if (params.action === 'amend') {
    result = lab.amend({
      amendmentId: crypto.randomUUID(),
      orderId: params.orderId,
      newValue: String(params.extra?.value ?? params.extra?.newValue ?? ''),
      reason: String(params.extra?.reason ?? 'amendment'),
      amendedBy: params.actorId,
    }).result
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
    let releasedReportId: string | null = null
    if (result) {
      const { data: existingReport, error: reportLookupError } = await db
        .from('lab_reports')
        .select('id')
        .eq('tenant_id', params.ctx.tenantId)
        .eq('lab_order_id', params.orderId)
        .eq('version', 1)
        .maybeSingle()
      if (reportLookupError && !/does not exist|schema cache/i.test(reportLookupError.message ?? '')) {
        warnings.push(reportLookupError.message)
      } else if (!existingReport) {
        const { data: specimen } = await db
          .from('lab_specimens')
          .select('specimen_type, collected_at, received_at')
          .eq('tenant_id', params.ctx.tenantId)
          .eq('lab_order_id', params.orderId)
          .maybeSingle()
        const report = buildLabReportArtifact({
          id: crypto.randomUUID(),
          tenantId: params.ctx.tenantId,
          facilityId: params.ctx.hospitalId,
          patientId: updated.patientId,
          encounterId: updated.encounterId,
          orderId: params.orderId,
          clinicalResultId: result.id,
          accession: updated.accessionNumber ?? params.orderId,
          testName: updated.testName,
          loincCode: updated.loincCode,
          specimenType: specimen?.specimen_type ?? null,
          collectedAt: specimen?.collected_at ?? null,
          receivedAt: specimen?.received_at ?? null,
          reportedAt: result.releasedAt ?? new Date().toISOString(),
          resultValue: result.resultValue,
          unit: result.unit,
          referenceRange: result.referenceRange,
          abnormalFlag: result.flag,
          isCritical: result.isCritical,
          verifiedBy: result.verifiedBy ?? params.actorId,
        })
        const { error: reportInsertError } = await db.from('lab_reports').insert({
          id: report.id,
          tenant_id: report.tenantId,
          facility_id: report.facilityId,
          patient_id: report.patientId,
          encounter_id: report.encounterId,
          lab_order_id: report.orderId,
          clinical_result_id: report.clinicalResultId,
          accession: report.accession,
          status: report.status,
          version: report.version,
          report_type: 'LAB_RESULT',
          generated_at: report.reportedAt,
          generated_by: params.actorId,
          verified_by: report.verifiedBy,
          released_at: report.reportedAt,
          template_version: report.templateVersion,
          html_snapshot: report.htmlSnapshot,
          content_hash: report.contentHash,
        })
        if (reportInsertError && !/duplicate|unique/i.test(reportInsertError.message ?? '')) {
          warnings.push(reportInsertError.message)
        } else {
          releasedReportId = report.id
        }
      } else {
        releasedReportId = String(existingReport.id)
      }
    }
    if (releasedReportId && result) {
      const outbox = new ExchangeOutbox()
      const event = outbox.append({
        eventType: 'LabResultReleased',
        tenantId: params.ctx.tenantId,
        facilityId: params.ctx.hospitalId,
        actorId: params.actorId,
        patientId: updated.patientId,
        encounterId: updated.encounterId,
        correlationId: updated.correlationId,
        payload: {
          reportId: releasedReportId,
          resultId: result.id,
          accession: updated.accessionNumber ?? null,
        },
        source: 'synapse-lab',
        aggregateId: params.orderId,
        action: 'released',
      })
      const eventPersist = await persistDomainEventsBestEffort(db, [event])
      if (!eventPersist.ok) warnings.push(eventPersist.error)
      }
    const { data: labTaskRow } = await db
      .from('department_tasks')
      .select('*')
      .eq('tenant_id', params.ctx.tenantId)
      .eq('source_resource', 'lab_orders')
      .eq('source_id', params.orderId)
      .eq('task_type', 'lab_order')
      .maybeSingle()

    if (labTaskRow) {
      const queue = new WorkQueue()
      const labTask = rowToDepartmentTask(labTaskRow)
      queue.tasks.set(labTask.id, labTask)
      if (labTask.status === 'REQUESTED') queue.start(labTask.id, params.actorId)
      if (queue.get(labTask.id)?.status === 'IN_PROGRESS') queue.complete(labTask.id, 'Laboratory result released', params.actorId)
      const review = queue.create({
        tenantId: params.ctx.tenantId,
        facilityId: params.ctx.hospitalId,
        hospitalId: params.ctx.hospitalId,
        patientId: updated.patientId,
        encounterId: updated.encounterId,
        requesterId: params.actorId,
        ownerDepartment: 'opd',
        ownerRole: 'doctor',
        taskType: 'doctor_result_review',
        priority: result?.isCritical ? 'STAT' : 'ROUTINE',
        title: result?.isCritical ? 'CRITICAL RESULT: Doctor review' : 'Doctor review: released result',
        description: `Review released ${updated.testName} for the ordering encounter`,
        sourceResource: 'lab_results',
        sourceId: result?.id ?? params.orderId,
        correlationId: updated.correlationId,
        idempotencyKey: `lab_results:${result?.id ?? params.orderId}:doctor-result-review`,
      })
      if (review.ok) {
        const handoffPersist = await persistWorkQueueArtifactsBestEffort(db, {
          tasks: [labTask, review.task],
          events: queue.outbox.list({ correlationId: updated.correlationId }),
        })
        if (handoffPersist.errors.length) warnings.push(...handoffPersist.errors)
      } else {
        warnings.push(review.error)
      }
    }

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


  if (params.action === 'amend' && result) {
    const report = buildLabReportArtifact({
      id: crypto.randomUUID(),
      tenantId: params.ctx.tenantId,
      facilityId: params.ctx.hospitalId,
      patientId: updated.patientId,
      encounterId: updated.encounterId,
      orderId: params.orderId,
      clinicalResultId: result.id,
      accession: updated.accessionNumber ?? params.orderId,
      testName: updated.testName,
      loincCode: updated.loincCode,
      reportedAt: new Date().toISOString(),
      resultValue: result.resultValue,
      unit: result.unit,
      referenceRange: result.referenceRange,
      abnormalFlag: result.flag,
      isCritical: result.isCritical,
      verifiedBy: result.verifiedBy ?? params.actorId,
      version: result.version,
      status: 'AMENDED',
      amendmentReason: String(params.extra?.reason ?? 'amendment'),
    })
    const { data: prior } = await db
      .from('lab_reports')
      .select('id')
      .eq('tenant_id', params.ctx.tenantId)
      .eq('lab_order_id', params.orderId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { error: amendReportError } = await db.from('lab_reports').insert({
      id: report.id,
      tenant_id: report.tenantId,
      facility_id: report.facilityId,
      patient_id: report.patientId,
      encounter_id: report.encounterId,
      lab_order_id: report.orderId,
      clinical_result_id: report.clinicalResultId,
      accession: report.accession,
      status: 'AMENDED',
      version: report.version,
      report_type: 'LAB_RESULT',
      generated_at: report.reportedAt,
      generated_by: params.actorId,
      verified_by: report.verifiedBy,
      released_at: report.reportedAt,
      supersedes_report_id: prior?.id ?? null,
      amendment_reason: report.amendmentReason,
      template_version: report.templateVersion,
      html_snapshot: report.htmlSnapshot,
      content_hash: report.contentHash,
    })
    if (amendReportError && !/duplicate|unique/i.test(amendReportError.message ?? '')) {
      warnings.push(amendReportError.message)
    }
  }

  return { order: updated, result, warnings }
}
