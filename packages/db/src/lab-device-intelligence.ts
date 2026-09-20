import { createHash, randomBytes } from "node:crypto"

export const LAB_CONNECTION_TYPES = [
  "SERIAL_RS232",
  "TCP_CLIENT",
  "TCP_SERVER",
  "HL7_MLLP",
  "ASTM",
  "FILE_WATCH",
  "CSV_IMPORT",
  "REST_HTTP",
  "VENDOR_API",
  "MANUAL",
] as const

export type LabConnectionType = (typeof LAB_CONNECTION_TYPES)[number]

export const LAB_VALIDATION_STATUSES = [
  "CONFIGURED",
  "CONNECTED",
  "VALIDATION",
  "PILOT",
  "ACTIVE",
  "SUSPENDED",
  "ERROR",
] as const

export type LabValidationStatus = (typeof LAB_VALIDATION_STATUSES)[number]

export const LAB_VALIDATION_TRANSITIONS: Record<LabValidationStatus, LabValidationStatus[]> = {
  CONFIGURED: ["CONNECTED", "ERROR"],
  CONNECTED: ["VALIDATION", "CONFIGURED", "ERROR"],
  VALIDATION: ["PILOT", "CONNECTED", "SUSPENDED", "ERROR"],
  PILOT: ["ACTIVE", "VALIDATION", "SUSPENDED", "ERROR"],
  ACTIVE: ["SUSPENDED", "ERROR"],
  SUSPENDED: ["VALIDATION", "PILOT", "ACTIVE", "ERROR"],
  ERROR: ["CONFIGURED", "CONNECTED"],
}

export const LAB_STAGING_STATUSES = [
  "RECEIVED",
  "PARSED",
  "MAPPED",
  "MATCHED",
  "UNMAPPED",
  "UNMATCHED",
  "VALIDATION_FAILED",
  "QC_BLOCKED",
  "READY_FOR_REVIEW",
  "ACCEPTED",
  "REJECTED",
] as const

export function canAdvanceDeviceValidation(from: LabValidationStatus, to: LabValidationStatus): boolean {
  return LAB_VALIDATION_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertDeviceValidationTransition(from: LabValidationStatus, to: LabValidationStatus): void {
  if (!canAdvanceDeviceValidation(from, to)) throw new Error("DEVICE_INVALID_TRANSITION")
}

export function deviceMayIngest(input: { active?: boolean | null; validationStatus: string }): boolean {
  if (input.validationStatus === "SUSPENDED" || input.validationStatus === "ERROR") return false
  return input.validationStatus === "VALIDATION" || input.validationStatus === "PILOT" || input.validationStatus === "ACTIVE"
}

export function connectedIsNotClinicallyTrusted(status: string): boolean {
  return status === "CONNECTED" || status === "CONFIGURED"
}

export type DeviceHealthInput = {
  validationStatus: string
  lastSeenAt?: string | null
  lastMessageAt?: string | null
  queueDepth?: number | null
  failedCount?: number | null
  unmappedCount?: number | null
  parseErrorCount?: number | null
  now?: number
  staleAfterMs?: number
}

export type DeviceOperationalHealth =
  | "Online"
  | "Disconnected"
  | "Queueing offline"
  | "Parser errors"
  | "Mapping required"
  | "Validation mode"
  | "Active"

export function deriveDeviceOperationalHealth(input: DeviceHealthInput): DeviceOperationalHealth {
  const now = input.now ?? Date.now()
  const staleAfterMs = input.staleAfterMs ?? 90_000
  const lastSeen = input.lastSeenAt ? new Date(input.lastSeenAt).getTime() : NaN
  const online = Number.isFinite(lastSeen) && now - lastSeen <= staleAfterMs
  if ((input.failedCount ?? 0) > 0 && (input.queueDepth ?? 0) > 0 && !online) return "Queueing offline"
  if ((input.parseErrorCount ?? 0) > 0) return "Parser errors"
  if ((input.unmappedCount ?? 0) > 0) return "Mapping required"
  if (!online) return "Disconnected"
  if (input.validationStatus === "VALIDATION" || input.validationStatus === "PILOT") return "Validation mode"
  if (input.validationStatus === "ACTIVE") return "Active"
  return "Online"
}

export function mappingCoverage(mapped: number, unmapped: number): { mapped: number; unmapped: number; percent: number } {
  const total = mapped + unmapped
  return {
    mapped,
    unmapped,
    percent: total === 0 ? 0 : Math.round((mapped / total) * 100),
  }
}

export type CriticalValueRule = {
  loincCode: string
  lower?: number | null
  upper?: number | null
  unit: string
}

export const DEFAULT_CRITICAL_VALUE_RULES: CriticalValueRule[] = [
  { loincCode: "718-7", lower: 6.5, upper: 20, unit: "g/dL" },
  { loincCode: "6690-2", lower: 1.5, upper: 50, unit: "10*9/L" },
  { loincCode: "2345-7", lower: 2.2, upper: 25, unit: "mmol/L" },
  { loincCode: "2160-0", lower: 30, upper: 800, unit: "umol/L" },
]

export function evaluateCriticalValue(input: {
  loincCode?: string | null
  value: string
  unit?: string | null
  rules?: CriticalValueRule[]
}): { critical: boolean; reason: string | null } {
  const numeric = Number(input.value)
  if (!Number.isFinite(numeric) || !input.loincCode) return { critical: false, reason: null }
  const rule = (input.rules ?? DEFAULT_CRITICAL_VALUE_RULES).find((row) => row.loincCode === input.loincCode)
  if (!rule) return { critical: false, reason: null }
  if (input.unit && rule.unit && input.unit !== rule.unit) {
    return { critical: false, reason: "unit_mismatch_review_required" }
  }
  if (rule.lower != null && numeric < rule.lower) return { critical: true, reason: "below_critical" }
  if (rule.upper != null && numeric > rule.upper) return { critical: true, reason: "above_critical" }
  return { critical: false, reason: null }
}

export function evaluateDeltaCheck(input: {
  current: number
  previous: number
  absoluteLimit?: number
  percentLimit?: number
}): { reviewRequired: boolean; delta: number; percent: number } {
  const delta = input.current - input.previous
  const percent = input.previous === 0 ? Infinity : Math.abs(delta / input.previous) * 100
  const absHit = input.absoluteLimit != null && Math.abs(delta) >= input.absoluteLimit
  const pctHit = input.percentLimit != null && percent >= input.percentLimit
  return { reviewRequired: absHit || pctHit, delta, percent }
}

export function detectUnitMismatch(analyzerUnit?: string | null, mappedUnit?: string | null): boolean {
  if (!analyzerUnit || !mappedUnit) return false
  return normalizeUnit(analyzerUnit) !== normalizeUnit(mappedUnit)
}

export function normalizeUnit(unit: string): string {
  return unit.replaceAll(" ", "").replaceAll("µ", "u").toLowerCase()
}

export function hashBridgeSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

export function issueBridgeSecret(): { secret: string; hash: string; prefix: string } {
  const secret = `lbk_${randomBytes(24).toString("base64url")}`
  return { secret, hash: hashBridgeSecret(secret), prefix: secret.slice(0, 12) }
}

export function serialConfig(input: {
  port?: string
  baudRate?: number
  dataBits?: number
  parity?: string
  stopBits?: number
  flowControl?: string
}): Record<string, unknown> {
  return {
    port: input.port ?? null,
    baudRate: input.baudRate ?? 9600,
    dataBits: input.dataBits ?? 8,
    parity: input.parity ?? "none",
    stopBits: input.stopBits ?? 1,
    flowControl: input.flowControl ?? "none",
  }
}

export function tcpConfig(input: { host?: string; port?: number; tls?: boolean; timeoutMs?: number }): Record<string, unknown> {
  return {
    host: input.host ?? null,
    port: input.port ?? null,
    tls: Boolean(input.tls),
    timeoutMs: input.timeoutMs ?? 30000,
  }
}

export function astmChecksum(payload: string): string {
  let sum = 0
  for (let i = 0; i < payload.length; i += 1) sum = (sum + payload.charCodeAt(i)) % 256
  return sum.toString(16).toUpperCase().padStart(2, "0")
}

export function omitDeviceSecrets(configuration: Record<string, unknown>): Record<string, unknown> {
  const { credential, apiKey, secret, password, token, ...safe } = configuration
  void credential
  void apiKey
  void secret
  void password
  void token
  return safe
}

/** Foundational outbound worklist contract. Not claimed as live bidirectional support. */
export type AnalyzerWorklistOutbound = {
  deviceId: string
  accessionNumber: string
  assays: string[]
  protocol: string
  status: "QUEUED_FOUNDATIONAL"
}

export function validateAstmFrame(raw: string): { ok: true } | { ok: false; reason: string } {
  const stx = raw.indexOf("\u0002")
  if (stx < 0) return { ok: true }
  const etx = raw.indexOf("\u0003", stx + 1)
  if (etx < 0) return { ok: false, reason: "ASTM_FRAME_INCOMPLETE" }
  const framed = raw.slice(stx + 1, etx + 1)
  const given = raw.slice(etx + 1).match(/[0-9A-Fa-f]{2}/)?.[0]
  if (!given) return { ok: false, reason: "ASTM_CHECKSUM_MISSING" }
  if (astmChecksum(framed) !== given.toUpperCase()) return { ok: false, reason: "ASTM_CHECKSUM_INVALID" }
  return { ok: true }
}
