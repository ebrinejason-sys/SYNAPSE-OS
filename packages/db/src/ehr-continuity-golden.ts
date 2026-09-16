/**
 * EHR continuity golden journey (domain).
 * One persons.id / Synapse ID across independent Hospital A, Lab B, and Pharmacy C.
 * Facility MRNs are aliases. An unauthorized fourth facility is denied.
 * In-memory fixtures only: does not prove persisted cross-facility linkage,
 * consent enforcement, authenticated HTTP access, or database RLS.
 */
import {
  encounterOpenedTimelineEvent,
  labOrderTimelineEvent,
  labResultReleasedTimelineEvent,
  medicationDispensedTimelineEvent,
  prescriptionTimelineEvent,
  edTriageTimelineEvent,
} from "./clinical-timeline.ts"
import {
  recordEncounterOpened,
  recordLabOrderPlaced,
  recordPrescriptionPlaced,
  recordTriageCompleted,
} from "./clinical-journey.ts"
import { generateSynapseId, identifiersAreSameNamespace, localMrnIdentifier } from "./identity.ts"
import { attachFacilityMrn, createCrosswalk, facilityMrn } from "./identity-crosswalk.ts"
import { LabWorkflow, barcodeFromAccession, formatAccession } from "./lab-workflow.ts"
import { shouldAutoMerge, type IdentityMatch } from "./mpi.ts"
import { dispensePrescription, verifyPrescription } from "./prescription-bridge.ts"
import { canAccessResource, type ScopeSession } from "./scope.ts"
import type { TimelineEventInput } from "./timeline.ts"

export type EhrContinuityStep = {
  id: string
  status: "PASS" | "FAIL"
  detail?: string
  artifacts?: Record<string, unknown>
}

export type EhrContinuityResult = {
  ok: boolean
  correlationId: string
  personId: string
  synapseId: string
  hospitalAMrn: string | null
  labBNumber: string | null
  pharmacyCMrn: string | null
  steps: EhrContinuityStep[]
  timeline: TimelineEventInput[]
}

function step(
  id: string,
  status: EhrContinuityStep["status"],
  detail?: string,
  artifacts?: Record<string, unknown>,
): EhrContinuityStep {
  return { id, status, detail, artifacts }
}

function push(
  steps: EhrContinuityStep[],
  id: string,
  ok: boolean,
  detail?: string,
  artifacts?: Record<string, unknown>,
) {
  steps.push(step(id, ok ? "PASS" : "FAIL", ok ? detail : detail ?? "assertion failed", artifacts))
}

function withPerson(event: TimelineEventInput, personId: string): TimelineEventInput {
  return { ...event, personId, patientId: personId }
}

/**
 * Prove a patient moving Hospital A → standalone Lab B → Hospital A → Pharmacy C
 * without duplicating persons.id, then deny a rogue fourth facility.
 */
export function runEhrContinuityGoldenJourney(input?: {
  personId?: string
  synapseId?: string
}): EhrContinuityResult {
  const steps: EhrContinuityStep[] = []
  const timeline: TimelineEventInput[] = []
  const personId = input?.personId ?? crypto.randomUUID()
  const synapseId = input?.synapseId ?? generateSynapseId("UG")
  const hospitalA = crypto.randomUUID()
  const labB = crypto.randomUUID()
  const pharmacyC = crypto.randomUUID()
  const rogueD = crypto.randomUUID()
  const encounterId = crypto.randomUUID()
  const doctorId = crypto.randomUUID()
  const nurseId = crypto.randomUUID()
  const pharmacistId = crypto.randomUUID()
  const patientAtA = crypto.randomUUID()
  const correlationId = encounterId

  let crosswalk = createCrosswalk(personId, synapseId, [
    { value: synapseId, type: "SYNAPSE_ID", sourceSystem: "synapse" },
  ])
  crosswalk = attachFacilityMrn(crosswalk, { mrn: "HOSP-A-1001", facilityId: hospitalA })
  crosswalk = attachFacilityMrn(crosswalk, { mrn: "PHARM-C-88", facilityId: pharmacyC })
  crosswalk = {
    ...crosswalk,
    aliases: [
      ...crosswalk.aliases,
      {
        personId,
        verified: true,
        value: "LAB-B-4411",
        type: "LAB_NUMBER",
        issuingFacilityId: labB,
        sourceSystem: "synapse-lab",
      },
    ],
  }

  push(steps, "person_identity", Boolean(personId) && synapseId.startsWith("SYN-UG-"), synapseId, {
    personId,
    synapseId,
  })
  push(
    steps,
    "facility_ids_are_aliases",
    facilityMrn(crosswalk, hospitalA) === "HOSP-A-1001" &&
      facilityMrn(crosswalk, pharmacyC) === "PHARM-C-88" &&
      crosswalk.aliases.every((alias) => alias.personId === personId),
    undefined,
    { aliases: crosswalk.aliases.length },
  )

  const sameStringDifferentIssuer = identifiersAreSameNamespace(
    localMrnIdentifier({ mrn: "HOSP-A-1001", facilityId: hospitalA }),
    localMrnIdentifier({ mrn: "HOSP-A-1001", facilityId: rogueD }),
  )
  push(steps, "issuer_scoped_mrn", sameStringDifferentIssuer === false)

  const unsafe: IdentityMatch = {
    leftId: personId,
    rightId: crypto.randomUUID(),
    confidence: 100,
    signals: [],
    recommendation: "auto_link_identifier",
  }
  push(steps, "no_auto_merge", shouldAutoMerge(unsafe) === false)

  const opened = recordEncounterOpened({
    tenantId: hospitalA,
    hospitalId: hospitalA,
    patientId: patientAtA,
    encounterId,
    requesterId: nurseId,
    chiefComplaint: "fever and chills",
    isSynthetic: true,
  })
  timeline.push(
    withPerson(
      encounterOpenedTimelineEvent({
        tenantId: hospitalA,
        hospitalId: hospitalA,
        patientId: personId,
        encounterId,
        chiefComplaint: "fever and chills",
        createdBy: nurseId,
      }),
      personId,
    ),
  )
  push(steps, "reception_encounter", opened.triageTask.sourceId === encounterId)

  const triaged = recordTriageCompleted({
    queue: opened.queue,
    triageTaskId: opened.triageTask.id,
    tenantId: hospitalA,
    hospitalId: hospitalA,
    patientId: patientAtA,
    encounterId,
    requesterId: nurseId,
  })
  timeline.push(
    withPerson(
      edTriageTimelineEvent({
        tenantId: hospitalA,
        hospitalId: hospitalA,
        patientId: personId,
        encounterId,
        chiefComplaint: "fever and chills",
        clinicalStage: "YELLOW",
        createdBy: nurseId,
      }),
      personId,
    ),
  )
  push(steps, "triage", Boolean(triaged.doctorTask.id))

  const lab = new LabWorkflow()
  const placed = recordLabOrderPlaced({
    tenantId: hospitalA,
    hospitalId: hospitalA,
    patientId: patientAtA,
    personId,
    encounterId,
    requesterId: doctorId,
    loincCode: "58413-6",
    testName: "Malaria Pf antigen",
    correlationId,
    queue: triaged.queue,
    lab,
    isSynthetic: true,
  })
  const performingTenantId = labB
  timeline.push(
    withPerson(
      labOrderTimelineEvent({
        tenantId: hospitalA,
        hospitalId: hospitalA,
        patientId: personId,
        orderId: placed.order.id,
        encounterId,
        testName: placed.order.testName,
        loincCode: placed.order.loincCode,
        createdBy: doctorId,
      }),
      personId,
    ),
  )
  push(
    steps,
    "lab_order_from_hospital_a",
    placed.order.tenantId === hospitalA && placed.order.personId === personId,
    undefined,
    { performingTenantId },
  )

  const accession = formatAccession("LABB", 1)
  lab.collect(placed.order.id, accession, barcodeFromAccession(accession), crypto.randomUUID())
  lab.receive(placed.order.id)
  lab.enterResult({ resultId: crypto.randomUUID(), orderId: placed.order.id, value: "Positive" })
  lab.verify(placed.order.id, "lab-scientist-b")
  const released = lab.release(placed.order.id)
  timeline.push(
    withPerson(
      labResultReleasedTimelineEvent({
        tenantId: labB,
        hospitalId: labB,
        patientId: personId,
        orderId: placed.order.id,
        encounterId,
        testName: released.testName,
        resultValue: released.resultValue,
        releasedBy: "lab-scientist-b",
      }),
      personId,
    ),
  )
  push(
    steps,
    "external_lab_b_release",
    released.resultValue === "Positive" &&
      lab.getOrder(placed.order.id).status === "RELEASED" &&
      performingTenantId === labB,
  )

  const prescribed = recordPrescriptionPlaced({
    tenantId: hospitalA,
    hospitalId: hospitalA,
    pharmacyTenantId: pharmacyC,
    patientId: patientAtA,
    personId,
    encounterId,
    requesterId: doctorId,
    medicationDisplay: "Artemether-lumefantrine",
    dose: "4 tabs BID x 3 days",
    quantity: 24,
    unit: "tablet",
    correlationId,
    queue: placed.queue,
    isSynthetic: true,
  })
  timeline.push(
    withPerson(
      prescriptionTimelineEvent({
        tenantId: hospitalA,
        hospitalId: hospitalA,
        patientId: personId,
        prescriptionId: prescribed.prescription.id,
        encounterId,
        medicationDisplay: prescribed.prescription.medicationDisplay,
        dose: prescribed.prescription.dose,
        createdBy: doctorId,
      }),
      personId,
    ),
  )
  push(
    steps,
    "prescription_to_pharmacy_c",
    prescribed.prescription.pharmacyTenantId === pharmacyC && prescribed.prescription.personId === personId,
  )

  const verified = verifyPrescription(prescribed.prescription, pharmacistId, "pharmacist")
  const dispensed = dispensePrescription({
    rx: verified,
    dispenserId: pharmacistId,
    role: "pharmacist",
    availableStock: 100,
  })
  timeline.push(
    withPerson(
      medicationDispensedTimelineEvent({
        tenantId: pharmacyC,
        hospitalId: pharmacyC,
        patientId: personId,
        prescriptionId: dispensed.rx.id,
        encounterId,
        medicationDisplay: dispensed.rx.medicationDisplay,
        quantity: dispensed.rx.quantity,
        dispensedBy: pharmacistId,
      }),
      personId,
    ),
  )
  push(steps, "pharmacy_c_dispense", dispensed.rx.status === "dispensed" && dispensed.remainingStock === 76)

  const personIds = new Set(timeline.map((event) => event.personId))
  const tenants = new Set(timeline.map((event) => event.tenantId))
  push(
    steps,
    "longitudinal_timeline",
    personIds.size === 1 &&
      personIds.has(personId) &&
      tenants.has(hospitalA) &&
      tenants.has(labB) &&
      tenants.has(pharmacyC),
    undefined,
    { events: timeline.length, tenants: [...tenants] },
  )

  const consented = new Set([hospitalA, labB, pharmacyC])
  const allowed: ScopeSession = {
    profileId: doctorId,
    assignments: [{ profileId: doctorId, role: "doctor", tenantId: hospitalA, isActive: true }],
  }
  const rogueId = crypto.randomUUID()
  const rogue: ScopeSession = {
    profileId: rogueId,
    assignments: [{ profileId: rogueId, role: "doctor", tenantId: rogueD, isActive: true }],
  }
  push(steps, "authorized_hospital_a_access", canAccessResource(allowed, { tenantId: hospitalA }) === true)
  push(
    steps,
    "unauthorized_facility_d_denied",
    canAccessResource(rogue, { tenantId: hospitalA }) === false && !consented.has(rogueD),
  )

  return {
    ok: steps.every((row) => row.status === "PASS"),
    correlationId,
    personId,
    synapseId,
    hospitalAMrn: facilityMrn(crosswalk, hospitalA),
    labBNumber: crosswalk.aliases.find((alias) => alias.type === "LAB_NUMBER")?.value ?? null,
    pharmacyCMrn: facilityMrn(crosswalk, pharmacyC),
    steps,
    timeline,
  }
}
