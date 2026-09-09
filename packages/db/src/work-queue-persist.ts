/**
 * Best-effort persistence for department_tasks and synapse_domain_events.
 * Keeps WorkQueue synchronous; callers invoke these after in-memory mutations.
 */

import type { OutboxRecord } from "@synapse/interop"
import { toDomainEventInsert } from "./exchange"
import type { DepartmentTask } from "./work-queue.ts"

export type DbClient = {
  from(table: string): {
    upsert(row: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }): PromiseLike<{ error: { message?: string } | null }>
  }
}

export function departmentTaskToRow(task: DepartmentTask): Record<string, unknown> {
  return {
    id: task.id,
    tenant_id: task.tenantId,
    facility_id: task.facilityId ?? null,
    hospital_id: task.hospitalId ?? null,
    patient_id: task.patientId ?? null,
    person_id: task.personId ?? null,
    encounter_id: task.encounterId ?? null,
    requester_id: task.requesterId ?? null,
    owner_department: task.ownerDepartment,
    owner_role: task.ownerRole ?? null,
    task_type: task.taskType,
    priority: task.priority,
    status: task.status,
    title: task.title,
    description: task.description ?? null,
    source_resource: task.sourceResource ?? null,
    source_id: task.sourceId ?? null,
    correlation_id: task.correlationId ?? null,
    causation_id: task.causationId ?? null,
    idempotency_key: task.idempotencyKey ?? null,
    due_at: task.dueAt ?? null,
    accepted_at: task.acceptedAt ?? null,
    completed_at: task.completedAt ?? null,
    cancelled_at: task.cancelledAt ?? null,
    assigned_to: task.assignedTo ?? null,
    result_summary: task.resultSummary ?? null,
    metadata: task.metadata ?? {},
    is_synthetic: task.isSynthetic,
    simulation_run_id: task.simulationRunId ?? null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  }
}

export function rowToDepartmentTask(row: Record<string, unknown>): DepartmentTask {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    facilityId: (row.facility_id as string | null) ?? null,
    hospitalId: (row.hospital_id as string | null) ?? null,
    patientId: (row.patient_id as string | null) ?? null,
    personId: (row.person_id as string | null) ?? null,
    encounterId: (row.encounter_id as string | null) ?? null,
    requesterId: (row.requester_id as string | null) ?? null,
    ownerDepartment: String(row.owner_department),
    ownerRole: (row.owner_role as string | null) ?? null,
    taskType: row.task_type as DepartmentTask["taskType"],
    priority: row.priority as DepartmentTask["priority"],
    status: row.status as DepartmentTask["status"],
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    sourceResource: (row.source_resource as string | null) ?? null,
    sourceId: (row.source_id as string | null) ?? null,
    correlationId: (row.correlation_id as string | null) ?? null,
    causationId: (row.causation_id as string | null) ?? null,
    idempotencyKey: (row.idempotency_key as string | null) ?? null,
    dueAt: (row.due_at as string | null) ?? null,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    assignedTo: (row.assigned_to as string | null) ?? null,
    resultSummary: (row.result_summary as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    isSynthetic: Boolean(row.is_synthetic),
    simulationRunId: (row.simulation_run_id as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function persistDepartmentTaskBestEffort(
  db: DbClient,
  task: DepartmentTask,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await db.from("department_tasks").upsert(departmentTaskToRow(task), {
      onConflict: "id",
    })
    if (error) return { ok: false, error: error.message ?? "department_tasks upsert failed" }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "department_tasks upsert threw" }
  }
}

export async function persistDomainEventsBestEffort(
  db: DbClient,
  events: OutboxRecord[],
): Promise<{ ok: true; inserted: number } | { ok: false; error: string; inserted: number }> {
  if (events.length === 0) return { ok: true, inserted: 0 }
  try {
    const rows = events.map((event) => toDomainEventInsert(event))
    const { error } = await db.from("synapse_domain_events").upsert(rows, {
      onConflict: "idempotency_key",
    })
    if (error) {
      // Idempotent replays may hit unique idempotency_key — treat as soft success for journey continuity.
      if (String(error.message ?? "").toLowerCase().includes("duplicate")) {
        return { ok: true, inserted: 0 }
      }
      return { ok: false, error: error.message ?? "synapse_domain_events insert failed", inserted: 0 }
    }
    return { ok: true, inserted: events.length }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "synapse_domain_events insert threw",
      inserted: 0,
    }
  }
}

export async function persistWorkQueueArtifactsBestEffort(
  db: DbClient,
  input: { tasks: DepartmentTask[]; events: OutboxRecord[] },
): Promise<{ tasksPersisted: number; eventsPersisted: number; errors: string[] }> {
  const errors: string[] = []
  let tasksPersisted = 0
  let eventsPersisted = 0

  for (const task of input.tasks) {
    const result = await persistDepartmentTaskBestEffort(db, task)
    if (result.ok) tasksPersisted += 1
    else errors.push(result.error)
  }

  const eventResult = await persistDomainEventsBestEffort(db, input.events)
  if (eventResult.ok) eventsPersisted = eventResult.inserted
  else errors.push(eventResult.error)

  return { tasksPersisted, eventsPersisted, errors }
}
