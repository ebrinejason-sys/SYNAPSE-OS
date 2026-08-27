/**
 * SYNAPSE Exchange outbox. Reliable, idempotent domain-event publication.
 * In-memory implementation is the unit of truth for tests; persistence maps to
 * synapse_domain_events when the table exists.
 */

import {
  EVENT_TYPE_VERSION,
  eventIdempotencyKey,
  sortEventChain,
  type DomainEventEnvelope,
  type DomainEventType,
  type EventSource,
  type OutboxRecord,
  type OutboxStatus,
} from "@synapse/interop"

export type { DomainEventEnvelope, DomainEventType, EventSource, OutboxRecord, OutboxStatus }

export type RecordDomainEventInput = {
  eventType: DomainEventType
  tenantId: string
  facilityId?: string | null
  actorId?: string | null
  patientId?: string | null
  personId?: string | null
  encounterId?: string | null
  correlationId: string
  causationId?: string | null
  payload: Record<string, unknown>
  source: EventSource
  aggregateId: string
  action: string
  timestamp?: string
  eventId?: string
  isSynthetic?: boolean
  simulationRunId?: string | null
}

export class ExchangeOutbox {
  private readonly records = new Map<string, OutboxRecord>()

  append(input: RecordDomainEventInput): OutboxRecord {
    const idempotency_key = eventIdempotencyKey({
      eventType: input.eventType,
      tenantId: input.tenantId,
      aggregateId: input.aggregateId,
      action: input.action,
    })
    const existing = this.records.get(idempotency_key)
    if (existing) return existing

    const envelope: OutboxRecord = {
      event_id: input.eventId ?? crypto.randomUUID(),
      event_type: input.eventType,
      version: EVENT_TYPE_VERSION[input.eventType],
      tenant_id: input.tenantId,
      facility_id: input.facilityId ?? input.tenantId,
      actor_id: input.actorId ?? null,
      patient_id: input.patientId ?? null,
      person_id: input.personId ?? null,
      encounter_id: input.encounterId ?? null,
      timestamp: input.timestamp ?? new Date().toISOString(),
      correlation_id: input.correlationId,
      causation_id: input.causationId ?? null,
      payload: input.payload,
      source: input.source,
      idempotency_key,
      is_synthetic: input.isSynthetic ?? false,
      simulation_run_id: input.simulationRunId ?? null,
      status: "pending",
      retry_count: 0,
      last_error: null,
      published_at: null,
    }
    this.records.set(idempotency_key, envelope)
    return envelope
  }

  markPublished(idempotencyKey: string, at = new Date().toISOString()): OutboxRecord | null {
    const record = this.records.get(idempotencyKey)
    if (!record) return null
    const updated: OutboxRecord = { ...record, status: "published", published_at: at, last_error: null }
    this.records.set(idempotencyKey, updated)
    return updated
  }

  markFailed(idempotencyKey: string, error: string, deadAfter = 8): OutboxRecord | null {
    const record = this.records.get(idempotencyKey)
    if (!record) return null
    const retry_count = record.retry_count + 1
    const status: OutboxStatus = retry_count >= deadAfter ? "dead" : "failed"
    const updated: OutboxRecord = { ...record, status, retry_count, last_error: error }
    this.records.set(idempotencyKey, updated)
    return updated
  }

  retry(idempotencyKey: string): OutboxRecord | null {
    const record = this.records.get(idempotencyKey)
    if (!record) return null
    if (record.status === "published" || record.status === "dead") return record
    const updated: OutboxRecord = { ...record, status: "pending" }
    this.records.set(idempotencyKey, updated)
    return updated
  }

  getByIdempotency(key: string): OutboxRecord | undefined {
    return this.records.get(key)
  }

  list(filter?: {
    tenantId?: string
    correlationId?: string
    eventType?: DomainEventType
    simulationRunId?: string
  }): OutboxRecord[] {
    return [...this.records.values()]
      .filter((row) => (filter?.tenantId ? row.tenant_id === filter.tenantId : true))
      .filter((row) => (filter?.correlationId ? row.correlation_id === filter.correlationId : true))
      .filter((row) => (filter?.eventType ? row.event_type === filter.eventType : true))
      .filter((row) => (filter?.simulationRunId ? row.simulation_run_id === filter.simulationRunId : true))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }

  chain(correlationId: string) {
    return sortEventChain(
      this.list({ correlationId }).map((row) => ({
        event_id: row.event_id,
        event_type: row.event_type,
        timestamp: row.timestamp,
        source: row.source,
        causation_id: row.causation_id,
      })),
    )
  }

  snapshot(): OutboxRecord[] {
    return this.list()
  }
}

export function toDomainEventInsert(record: OutboxRecord): Record<string, unknown> {
  return {
    event_id: record.event_id,
    event_type: record.event_type,
    version: record.version,
    tenant_id: record.tenant_id,
    facility_id: record.facility_id ?? null,
    actor_id: record.actor_id ?? null,
    patient_id: record.patient_id ?? null,
    person_id: record.person_id ?? null,
    encounter_id: record.encounter_id ?? null,
    occurred_at: record.timestamp,
    correlation_id: record.correlation_id,
    causation_id: record.causation_id ?? null,
    payload: record.payload,
    source: record.source,
    idempotency_key: record.idempotency_key,
    is_synthetic: record.is_synthetic ?? false,
    simulation_run_id: record.simulation_run_id ?? null,
    status: record.status,
    retry_count: record.retry_count,
    last_error: record.last_error ?? null,
    published_at: record.published_at ?? null,
  }
}
