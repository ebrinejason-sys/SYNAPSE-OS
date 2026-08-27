export type CapabilityStatus = "OPERATIONAL" | "PARTIAL" | "PLANNED" | "PILOT_READY"

export {
  PRODUCT_MANIFEST,
  canAdvertiseAsLive,
  statusLabel,
  integrationLabel,
  getCapability,
  type ManifestStatus,
} from "./product-manifest"

/** UI may only present a workflow as live when the registry says OPERATIONAL. */
export function canClaimOperational(status: CapabilityStatus): boolean {
  return status === "OPERATIONAL"
}

export function assertNotFakeOperational(status: CapabilityStatus, feature: string): void {
  if (status === "PLANNED") {
    throw new Error(`FEATURE_PLANNED:${feature}`)
  }
}

export function isPilotEligible(status: CapabilityStatus): boolean {
  return status === "OPERATIONAL" || status === "PILOT_READY"
}
