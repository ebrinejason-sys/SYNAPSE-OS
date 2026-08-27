/**
 * Synapse Adapter SDK.
 *
 * Preference order: official API → FHIR → HL7 v2 → approved middleware →
 * read-only database last. Never invent undocumented production APIs.
 */

import { INTEGRATION_PREFERENCE, type AdapterResult, type IntegrationPreference } from "../adapter"
import type { CanonicalBundle, CanonicalPerson } from "../canonical"

export type AdapterMode = "native" | "overlay" | "network"
export type AdapterHealthStatus = "healthy" | "degraded" | "down" | "simulation" | "not_connected"

export type NetworkFault =
  | "none"
  | "latency"
  | "timeout"
  | "duplicate"
  | "out_of_order"
  | "unavailable"
  | "invalid_code"
  | "identifier_mismatch"
  | "stale_result"
  | "intermittent"

export type AdapterIdentity = {
  id: string
  name: string
  system: string
  mode: AdapterMode
  simulation: boolean
  version: string
  preference: IntegrationPreference
}

export type AdapterHealth = {
  status: AdapterHealthStatus
  lastSuccessAt?: string | null
  lastFailureAt?: string | null
  detail?: string
}

export type ReconcileResult = {
  action: "link" | "reject" | "review"
  reason: string
}

export interface SynapseAdapter {
  identify(): AdapterIdentity
  capabilities(): string[]
  health(): AdapterHealth
  pullPatients(query?: Record<string, string>): Promise<AdapterResult<CanonicalPerson[]>>
  pullEncounters(query?: Record<string, string>): Promise<AdapterResult<CanonicalBundle>>
  pullResults(query?: Record<string, string>): Promise<AdapterResult<CanonicalBundle>>
  pushPatient(person: CanonicalPerson): Promise<AdapterResult<{ remoteId: string }>>
  pushOrder(order: Record<string, unknown>): Promise<AdapterResult<{ remoteId: string }>>
  pushPrescription(rx: Record<string, unknown>): Promise<AdapterResult<{ remoteId: string }>>
  mapInbound(payload: unknown): AdapterResult<CanonicalBundle>
  mapOutbound(resource: unknown): AdapterResult<unknown>
  reconcile(local: CanonicalPerson, remote: CanonicalPerson): ReconcileResult
}

export type AdapterRegistryEntry = {
  identity: AdapterIdentity
  adapter: SynapseAdapter
}

export class AdapterRegistry {
  private adapters = new Map<string, SynapseAdapter>()

  register(adapter: SynapseAdapter): void {
    this.adapters.set(adapter.identify().id, adapter)
  }

  get(id: string): SynapseAdapter | undefined {
    return this.adapters.get(id)
  }

  list(): AdapterIdentity[] {
    return [...this.adapters.values()].map((item) => item.identify())
  }
}

export function applyNetworkFault<T>(
  result: AdapterResult<T>,
  fault: NetworkFault,
): AdapterResult<T> {
  if (fault === "none") return result
  if (fault === "timeout" || fault === "unavailable") {
    return { ok: false, code: fault.toUpperCase(), message: `Simulated ${fault}` }
  }
  if (fault === "invalid_code") {
    return { ok: false, code: "INVALID_CODE", message: "Simulated invalid terminology code" }
  }
  if (fault === "identifier_mismatch") {
    return { ok: false, code: "IDENTIFIER_MISMATCH", message: "Simulated patient identifier mismatch" }
  }
  return result
}

export function defaultReconcile(local: CanonicalPerson, remote: CanonicalPerson): ReconcileResult {
  const localIds = new Set(local.identifiers.map((item) => `${item.system}|${item.value}`))
  const overlap = remote.identifiers.some((item) => localIds.has(`${item.system}|${item.value}`))
  if (overlap) return { action: "link", reason: "shared identifier namespace+value" }
  if (local.name.text && remote.name.text && local.name.text === remote.name.text) {
    return { action: "review", reason: "name match without shared identifier — no auto-merge" }
  }
  return { action: "reject", reason: "insufficient identity evidence" }
}

export { INTEGRATION_PREFERENCE }
