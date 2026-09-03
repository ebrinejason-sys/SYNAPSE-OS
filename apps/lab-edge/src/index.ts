/**
 * SYNAPSE Lab Edge — LAN gateway for analyzer connectivity.
 *
 * Deploy on a laboratory computer (Linux service / Docker).
 * Cloud Lab never holds a direct serial connection.
 *
 * This package is a Wave 2 scaffold: durable local queue + driver SDK contracts.
 * Protocol drivers (ASTM / HL7 MLLP / serial) plug into AnalyzerDriver.
 */

export const LAB_EDGE_VERSION = "0.1.0-wave2-scaffold"

export type AnalyzerCapability =
  | "RESULT_UPLOAD"
  | "ORDER_DOWNLOAD"
  | "HOST_QUERY"
  | "QC_UPLOAD"
  | "PATIENT_QUERY"

export type ConnectionType =
  | "SERIAL_RS232"
  | "TCP_CLIENT"
  | "TCP_SERVER"
  | "HL7_MLLP"
  | "ASTM"
  | "FILE_WATCH"
  | "CSV_IMPORT"
  | "REST_HTTP"
  | "VENDOR_API"
  | "MANUAL"

export type NormalizedAnalyzerResult = {
  accessionNumber?: string
  analyzerCode: string
  value: string
  unit?: string
  flags?: Record<string, unknown>
  instrumentFlags?: Record<string, unknown>
  runAt?: string
  rawMessageRef: string
}

/**
 * Drivers parse/produce messages only — they never write clinical results.
 */
export interface AnalyzerDriver {
  identify(): { manufacturer: string; model: string; protocol: string }
  capabilities(): AnalyzerCapability[]
  connect(): Promise<void>
  disconnect(): Promise<void>
  health(): Promise<{ online: boolean; detail: string }>
  parseIncoming(raw: string): Promise<NormalizedAnalyzerResult[]>
  buildOrderMessage?(accession: string, assays: string[]): string
  buildHostQueryResponse?(accession: string, assays: string[]): string
  acknowledge?(ok: boolean): string
}

export type EdgeQueueItem = {
  id: string
  createdAt: string
  payloadHash: string
  rawPayload: string
  protocol: string
  uploaded: boolean
  attempts: number
}

/** In-memory stand-in; production Edge uses SQLite. */
export class EdgeDurableQueue {
  private items: EdgeQueueItem[] = []

  enqueue(rawPayload: string, protocol: string): EdgeQueueItem {
    const payloadHash = simpleHash(rawPayload)
    const existing = this.items.find((i) => i.payloadHash === payloadHash)
    if (existing) return existing
    const item: EdgeQueueItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      payloadHash,
      rawPayload,
      protocol,
      uploaded: false,
      attempts: 0,
    }
    this.items.push(item)
    return item
  }

  pending(): EdgeQueueItem[] {
    return this.items.filter((i) => !i.uploaded)
  }

  markUploaded(id: string) {
    const item = this.items.find((i) => i.id === id)
    if (item) item.uploaded = true
  }
}

function simpleHash(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0
  return `h${Math.abs(h)}`
}

export function createEdgeRuntime() {
  return {
    version: LAB_EDGE_VERSION,
    queue: new EdgeDurableQueue(),
  }
}
