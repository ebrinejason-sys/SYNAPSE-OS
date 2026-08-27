/**
 * Offline / Edge architecture contract. Not a fake sync implementation.
 * Durable commands must never disappear because connectivity failed.
 */

export const EDGE_ARCHITECTURE_STATUS = "roadmap" as const

export const EDGE_PIPELINE = [
  "device",
  "encrypted_local_database",
  "durable_command_queue",
  "sync_engine",
  "conflict_resolution",
  "server",
] as const

export type EdgePipelineStage = (typeof EDGE_PIPELINE)[number]

export const PHARMACY_WEB_OFFLINE_CHECKOUT = {
  claim: "offline checkout",
  status: "disabled",
  reason:
    "saveOfflineTransaction and queueMutation throw OfflineUnavailableError. POS refuses to complete a sale while offline.",
} as const

export const MOBILE_SINGLE_COUNTER_OFFLINE = {
  claim: "encrypted SQLite outbox for single-counter Android",
  status: "partial",
  reason: "Prototype exists; physical force-stop/reboot proof is still required before OPERATIONAL.",
} as const

export function describeEdgeReadiness(): {
  status: typeof EDGE_ARCHITECTURE_STATUS
  pipeline: typeof EDGE_PIPELINE
  pharmacyWebCheckout: typeof PHARMACY_WEB_OFFLINE_CHECKOUT
  mobile: typeof MOBILE_SINGLE_COUNTER_OFFLINE
} {
  return {
    status: EDGE_ARCHITECTURE_STATUS,
    pipeline: EDGE_PIPELINE,
    pharmacyWebCheckout: PHARMACY_WEB_OFFLINE_CHECKOUT,
    mobile: MOBILE_SINGLE_COUNTER_OFFLINE,
  }
}
