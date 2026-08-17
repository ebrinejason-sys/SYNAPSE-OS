import type { CanonicalBundle, CanonicalPerson } from "./canonical"

export const INTEGRATION_PREFERENCE = [
  "official_api",
  "fhir",
  "hl7v2",
  "approved_middleware",
  "readonly_database",
] as const

export type IntegrationPreference = (typeof INTEGRATION_PREFERENCE)[number]

export type AdapterConfig = {
  tenantId: string
  adapterType: "fhir" | "hl7v2" | "astm" | "openmrs" | "ugandaemr" | "lis" | "rest" | "webhook" | "other"
  displayName: string
  endpointUrl?: string | null
  credentialRef?: string | null
  mapping?: Record<string, unknown>
}

export type AdapterResult<T> = {
  ok: true
  data: T
  rawAuditRef?: string
} | {
  ok: false
  code: string
  message: string
}

export interface HealthcareAdapter {
  readonly type: AdapterConfig["adapterType"]
  readonly neverDirectInternetAnalyzers: true
  translateInbound(payload: unknown, config: AdapterConfig): AdapterResult<CanonicalBundle>
  translateOutbound?(resource: unknown, config: AdapterConfig): AdapterResult<unknown>
}

export function assertNoDirectDbFirst(preference: IntegrationPreference[]): void {
  const dbIndex = preference.indexOf("readonly_database")
  if (dbIndex === 0) {
    throw new Error("DIRECT_DB_NOT_PREFERRED")
  }
}

export function extractOpenMrsPatient(payload: Record<string, unknown>): CanonicalPerson | null {
  const uuid = String(payload.uuid ?? payload.id ?? "")
  if (!uuid) return null
  const display = String(payload.display ?? payload.name ?? "")
  const identifiers = Array.isArray(payload.identifiers)
    ? (payload.identifiers as Array<Record<string, unknown>>).map((i) => ({
        system: String(i.identifierType ?? i.system ?? "openmrs"),
        value: String(i.identifier ?? i.value ?? ""),
        type: "OPENMRS",
      }))
    : []
  return {
    resourceType: "Person",
    id: uuid,
    identifiers: identifiers.filter((i) => i.value),
    name: { given: display ? [display] : [], text: display },
  }
}

export function extractUgandaEmrPatient(payload: Record<string, unknown>): CanonicalPerson | null {
  const person = extractOpenMrsPatient(payload)
  if (!person) return null
  return {
    ...person,
    identifiers: person.identifiers.map((i) => ({ ...i, type: "UGANDAEMR", system: i.system || "ugandaemr" })),
  }
}

export function parseHl7PidIdentifier(pidSegment: string): { value: string; assigningAuthority: string } | null {
  // PID-3 is typically ID^check^assigning_authority
  const fields = pidSegment.split("|")
  const pid3 = fields[3] ?? ""
  if (!pid3) return null
  const parts = pid3.split("^")
  const value = parts[0]?.trim()
  if (!value) return null
  return { value, assigningAuthority: parts[3] || parts[2] || "unknown" }
}

export function parseAstmResult(record: string): { accession?: string; testCode?: string; value?: string } {
  // ASTM H/P/O/R records. R|1|^^^HB|13.2|g/dL
  if (!record.startsWith("R|")) return {}
  const fields = record.split("|")
  const test = fields[2] ?? ""
  const testCode = test.split("^").filter(Boolean).pop()
  return {
    testCode,
    value: fields[3],
  }
}

export type LabGatewayMessage = {
  analyzerId: string
  protocol: "hl7" | "astm" | "tcp" | "serial" | "middleware" | "other"
  accessionNumber?: string
  rawMessage: string
  direction: "inbound" | "outbound"
}

export function resolveSpecimenChain(params: {
  accessionNumber: string
  specimen: { id: string; orderId?: string | null; encounterId?: string | null; personId?: string | null }
}): { specimenId: string; orderId: string | null; encounterId: string | null; personId: string | null } {
  return {
    specimenId: params.specimen.id,
    orderId: params.specimen.orderId ?? null,
    encounterId: params.specimen.encounterId ?? null,
    personId: params.specimen.personId ?? null,
  }
}

export function createAdapter(type: AdapterConfig["adapterType"]): HealthcareAdapter {
  return {
    type,
    neverDirectInternetAnalyzers: true,
    translateInbound(payload) {
      if (type === "openmrs" && payload && typeof payload === "object") {
        const person = extractOpenMrsPatient(payload as Record<string, unknown>)
        if (!person) return { ok: false, code: "UNMAPPED", message: "No OpenMRS patient uuid" }
        return { ok: true, data: { resources: [person] } }
      }
      if (type === "ugandaemr" && payload && typeof payload === "object") {
        const person = extractUgandaEmrPatient(payload as Record<string, unknown>)
        if (!person) return { ok: false, code: "UNMAPPED", message: "No UgandaEMR patient" }
        return { ok: true, data: { resources: [person] } }
      }
      if (type === "hl7v2" && typeof payload === "string") {
        const pid = payload.split(/\r|\n/).find((l) => l.startsWith("PID"))
        if (!pid) return { ok: false, code: "NO_PID", message: "HL7 message missing PID" }
        const ident = parseHl7PidIdentifier(pid)
        if (!ident) return { ok: false, code: "NO_PID3", message: "HL7 PID-3 missing" }
        return {
          ok: true,
          data: {
            resources: [
              {
                resourceType: "Person",
                id: ident.value,
                identifiers: [{ system: ident.assigningAuthority, value: ident.value }],
                name: { given: [], text: "" },
              },
            ],
          },
        }
      }
      if (type === "astm" && typeof payload === "string") {
        const parsed = parseAstmResult(payload)
        return {
          ok: true,
          data: {
            resources: [
              {
                resourceType: "Observation",
                id: parsed.testCode ?? "unknown",
                code: parsed.testCode ?? "",
                display: parsed.testCode ?? "",
                value: parsed.value,
                provenance: "LAB_VERIFIED",
              },
            ],
          },
        }
      }
      return { ok: false, code: "ADAPTER_STUB", message: `Inbound translation for ${type} is not fully implemented` }
    },
  }
}
