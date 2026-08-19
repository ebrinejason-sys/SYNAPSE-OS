export type CapabilityStatus = "OPERATIONAL" | "PARTIAL" | "PLANNED"

/** UI may only present a workflow as live when the registry says OPERATIONAL. */
export function canClaimOperational(status: CapabilityStatus): boolean {
  return status === "OPERATIONAL"
}

export function assertNotFakeOperational(status: CapabilityStatus, feature: string): void {
  if (status === "PLANNED") {
    throw new Error(`FEATURE_PLANNED:${feature}`)
  }
}
