import { describe, expect, it } from "vitest"
import {
  clinicalFactDisplay,
  formatSynapseId,
  generateSynapseId,
  identifierNamespaceKey,
  identifiersAreSameNamespace,
  isClinicallyVerified,
  isValidSynapseId,
  localMrnIdentifier,
  normalizePhone,
  buildPersonRegistration,
} from "@synapse/db/identity"
import { scoreIdentityMatch, shouldAutoMerge } from "@synapse/db/mpi"
import { assertSiteAllowed, canAccessResource } from "@synapse/db/scope"
import { pharmacyDispenseTimelineEvent, toTimelineInsert } from "@synapse/db/timeline"
import { hasPurposeConsent } from "@synapse/db/consent"
import { isReplaySafe, toOutboxInsert } from "@synapse/db/offline"
import { contrastRatio, meetsContrast, palettes } from "@synapse/ui"
import {
  createAdapter,
  fhirResourceToCanonicalType,
  parseAstmResult,
  parseHl7PidIdentifier,
  resolveSpecimenChain,
} from "@synapse/interop"

describe("SYNAPSE ID", () => {
  it("generates a valid SYN-UG id with check character", () => {
    const id = generateSynapseId("UG")
    expect(id.startsWith("SYN-UG-")).toBe(true)
    expect(isValidSynapseId(id)).toBe(true)
  })

  it("is deterministic for the same entropy", () => {
    const entropy = Uint8Array.from([1, 2, 3, 4, 5])
    expect(formatSynapseId("UG", entropy)).toBe(formatSynapseId("UG", entropy))
    expect(isValidSynapseId(formatSynapseId("KE", entropy))).toBe(true)
  })
})

describe("identifier namespaces", () => {
  it("treats the same MRN from two hospitals as different identifiers", () => {
    const a = localMrnIdentifier({ mrn: "12345", facilityId: "facility-a" })
    const b = localMrnIdentifier({ mrn: "12345", facilityId: "facility-b" })
    expect(a.value).toBe(b.value)
    expect(identifiersAreSameNamespace(a, b)).toBe(false)
    expect(identifierNamespaceKey(a)).not.toBe(identifierNamespaceKey(b))
  })

  it("matches identifiers only inside the same issuer namespace", () => {
    const a = localMrnIdentifier({ mrn: "12345", facilityId: "facility-a" })
    const b = localMrnIdentifier({ mrn: "12345", facilityId: "facility-a" })
    expect(identifiersAreSameNamespace(a, b)).toBe(true)
  })
})

describe("identity registration payload", () => {
  it("requires a name and normalizes Uganda phones", () => {
    expect(() => buildPersonRegistration({})).toThrow("PERSON_NAME_REQUIRED")
    const built = buildPersonRegistration({ fullName: "Amina Nalwoga", phone: "0772123456" })
    expect(built.fullName).toBe("Amina Nalwoga")
    expect(normalizePhone("0772123456")).toBe("+256772123456")
  })
})

describe("MPI", () => {
  const base = {
    id: "p1",
    fullName: "Amina Nalwoga",
    dateOfBirth: "1990-01-02",
    sex: "F",
    identifiers: [] as ReturnType<typeof localMrnIdentifier>[],
  }

  it("does not auto-merge uncertain demographic matches", () => {
    const match = scoreIdentityMatch(base, {
      ...base,
      id: "p2",
      phone: "0772000000",
    })
    expect(match.recommendation).toBe("review")
    expect(shouldAutoMerge(match)).toBe(false)
  })

  it("queues review for same MRN string from different issuers", () => {
    const match = scoreIdentityMatch(
      {
        ...base,
        identifiers: [localMrnIdentifier({ mrn: "MRN-1", facilityId: "h1" })],
      },
      {
        ...base,
        id: "p2",
        identifiers: [localMrnIdentifier({ mrn: "MRN-1", facilityId: "h2" })],
      },
    )
    expect(match.confidence).toBeLessThan(100)
    expect(match.signals.some((s) => s.name === "cross_issuer_identifier_string")).toBe(true)
    expect(shouldAutoMerge(match)).toBe(false)
  })

  it("auto-links only exact same-namespace identifiers, still without merging persons", () => {
    const ident = localMrnIdentifier({ mrn: "MRN-1", facilityId: "h1" })
    const match = scoreIdentityMatch(
      { ...base, identifiers: [ident] },
      { ...base, id: "p2", identifiers: [ident] },
    )
    expect(match.recommendation).toBe("auto_link_identifier")
    expect(shouldAutoMerge(match)).toBe(false)
  })
})

describe("scoped RBAC", () => {
  it("denies a cashier scoped to branch A from branch B", () => {
    const session = {
      profileId: "u1",
      assignments: [{ profileId: "u1", role: "pharmacist", tenantId: "t1", siteId: "store-a" }],
    }
    expect(canAccessResource(session, { tenantId: "t1", siteId: "store-b" })).toBe(false)
    expect(assertSiteAllowed(session, "store-b", "t1").ok).toBe(false)
    expect(assertSiteAllowed(session, "store-a", "t1").ok).toBe(true)
  })

  it("lets a tenant-wide manager see every site in that facility", () => {
    const session = {
      profileId: "u2",
      assignments: [{ profileId: "u2", role: "regional_pharmacy_manager", tenantId: "t1" }],
    }
    expect(canAccessResource(session, { tenantId: "t1", siteId: "store-b" })).toBe(true)
    expect(canAccessResource(session, { tenantId: "t2", siteId: "store-x" })).toBe(false)
  })

  it("does not grant access merely because two facilities share a platform", () => {
    const session = {
      profileId: "u3",
      assignments: [{ profileId: "u3", role: "pharmacist", tenantId: "t1" }],
    }
    expect(canAccessResource(session, { tenantId: "t2" })).toBe(false)
  })
})

describe("timeline", () => {
  it("publishes a pharmacy dispense event with provenance and source refs", () => {
    const event = pharmacyDispenseTimelineEvent({
      tenantId: "t1",
      personId: "person-1",
      saleId: "sale-1",
      receiptNumber: "RCT-9",
      facilityName: "Fort Portal Main Pharmacy",
      itemSummary: "Amoxicillin 500mg",
    })
    expect(event.eventType).toBe("pharmacy")
    expect(event.provenance).toBe("PROVIDER_VERIFIED")
    const row = toTimelineInsert(event)
    expect(row.person_id).toBe("person-1")
    expect(row.source_id).toBe("sale-1")
  })
})

describe("consent", () => {
  it("is purpose-scoped rather than a global boolean", () => {
    const records = [
      {
        personId: "p1",
        purpose: "emergency_profile" as const,
        status: "granted" as const,
      },
    ]
    expect(hasPurposeConsent(records, "p1", "emergency_profile")).toBe(true)
    expect(hasPurposeConsent(records, "p1", "blood_donor_contact")).toBe(false)
  })
})

describe("offline outbox", () => {
  it("requires an idempotency key and treats matching keys as replay-safe", () => {
    expect(isReplaySafe("k1", "k1")).toBe(true)
    expect(isReplaySafe("k1", "k2")).toBe(false)
    expect(() =>
      toOutboxInsert({
        tenantId: "t1",
        mutationType: "pharmacy.sale",
        idempotencyKey: "",
        payload: {},
      }),
    ).toThrow("IDEMPOTENCY_KEY_REQUIRED")
  })
})

describe("clinical provenance", () => {
  it("never treats self-reported blood group as clinically verified", () => {
    const fact = { value: "O+", provenance: "SELF_REPORTED" as const, verificationStatus: "UNVERIFIED" as const }
    expect(isClinicallyVerified(fact)).toBe(false)
    expect(clinicalFactDisplay(fact).stateLabel).toMatch(/unverified/i)
    expect(
      isClinicallyVerified({
        value: "O+",
        provenance: "LAB_VERIFIED",
        verificationStatus: "VERIFIED",
      }),
    ).toBe(true)
  })
})

describe("accessibility tokens", () => {
  it("meets WCAG AA contrast for text on light and dark palettes", () => {
    for (const theme of ["light", "dark"] as const) {
      const p = palettes[theme]
      expect(meetsContrast(p.text, p.bg, "aa-normal")).toBe(true)
      expect(meetsContrast(p.textMuted, p.bg, "aa-normal")).toBe(true)
      expect(meetsContrast(p.accentFg, p.accent, "aa-normal")).toBe(true)
      expect(contrastRatio(p.border, p.bg)).toBeGreaterThanOrEqual(3)
    }
  })
})

describe("interoperability adapters", () => {
  it("maps FHIR Patient to the SYNAPSE Person canonical type", () => {
    expect(fhirResourceToCanonicalType("Patient")).toBe("Person")
  })

  it("translates OpenMRS identifiers without coupling the core to OpenMRS", () => {
    const adapter = createAdapter("openmrs")
    const result = adapter.translateInbound(
      { uuid: "omrs-1", display: "Amina", identifiers: [{ identifier: "1000A", identifierType: "OpenMRS ID" }] },
      { tenantId: "t1", adapterType: "openmrs", displayName: "test" },
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.resources[0]?.resourceType).toBe("Person")
  })

  it("parses HL7 PID-3 against the assigning authority, not a global MRN namespace", () => {
    const ident = parseHl7PidIdentifier("PID|||ABC123^^^BUHINGA")
    expect(ident).toEqual({ value: "ABC123", assigningAuthority: "BUHINGA" })
  })

  it("maps ASTM results and resolves specimen → order → encounter → person", () => {
    expect(parseAstmResult("R|1|^^^HB|13.2|g/dL")).toEqual({ testCode: "HB", value: "13.2" })
    expect(
      resolveSpecimenChain({
        accessionNumber: "SPC-1",
        specimen: { id: "spc", orderId: "ord", encounterId: "enc", personId: "person" },
      }),
    ).toEqual({
      specimenId: "spc",
      orderId: "ord",
      encounterId: "enc",
      personId: "person",
    })
  })
})
