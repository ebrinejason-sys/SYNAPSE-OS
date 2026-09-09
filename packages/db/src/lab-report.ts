import { createHash } from "node:crypto"

export type LabReportStatus = "FINAL" | "AMENDED"

export type LabReportInput = {
  id: string
  tenantId: string
  facilityId?: string | null
  patientId: string
  encounterId?: string | null
  orderId: string
  clinicalResultId: string
  accession: string
  testName: string
  loincCode: string
  specimenType?: string | null
  collectedAt?: string | null
  receivedAt?: string | null
  reportedAt: string
  resultValue: string
  unit?: string | null
  referenceRange?: string | null
  abnormalFlag?: string | null
  isCritical?: boolean
  verifiedBy?: string | null
  version?: number
  status?: LabReportStatus
  supersedesReportId?: string | null
  amendmentReason?: string | null
}

export type LabReportArtifact = LabReportInput & {
  htmlSnapshot: string
  contentHash: string
  templateVersion: "lab-report.v1"
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function renderLabReportHtml(input: LabReportInput): string {
  const critical = input.isCritical ? " CRITICAL" : ""
  return `<!doctype html><html><head><meta charset="utf-8"><title>Laboratory Report ${escapeHtml(input.accession)}</title><style>body{font-family:Arial,sans-serif;color:#17212b;margin:32px}header{border-bottom:2px solid #17212b;margin-bottom:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd3d9;padding:8px;text-align:left}.flag{font-weight:700}</style></head><body><header><h1>Laboratory Report</h1><p>Accession: ${escapeHtml(input.accession)} · Version ${input.version ?? 1}</p></header><section><h2>Patient and specimen</h2><p>Patient ID: ${escapeHtml(input.patientId)}</p><p>Specimen: ${escapeHtml(input.specimenType)}</p><p>Collected: ${escapeHtml(input.collectedAt)} · Received: ${escapeHtml(input.receivedAt)}</p></section><table><thead><tr><th>Test</th><th>LOINC</th><th>Result</th><th>Unit</th><th>Reference interval</th><th>Flag</th></tr></thead><tbody><tr><td>${escapeHtml(input.testName)}</td><td>${escapeHtml(input.loincCode)}</td><td>${escapeHtml(input.resultValue)}</td><td>${escapeHtml(input.unit)}</td><td>${escapeHtml(input.referenceRange)}</td><td class="flag">${escapeHtml(input.abnormalFlag)}${critical}</td></tr></tbody></table><p>Reported: ${escapeHtml(input.reportedAt)}</p><p>Verified by: ${escapeHtml(input.verifiedBy)}</p></body></html>`
}

export function buildLabReportArtifact(input: LabReportInput): LabReportArtifact {
  const htmlSnapshot = renderLabReportHtml(input)
  return {
    ...input,
    version: input.version ?? 1,
    status: input.status ?? "FINAL",
    templateVersion: "lab-report.v1",
    htmlSnapshot,
    contentHash: createHash("sha256").update(htmlSnapshot).digest("hex"),
  }
}