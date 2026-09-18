import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { supabaseAdmin } from "@synapse/db/admin"
import { recordEncounterOpened, recordLabOrderPlaced } from "@synapse/db/clinical-journey"
import { persistWorkQueueArtifactsBestEffort } from "@synapse/db/work-queue-persist"
import { persistLabOrderBestEffort } from "@synapse/db/lab-order-persist"
import {
  MALARIA_PF_ANTIGEN_LOINC,
  MALARIA_PF_ANTIGEN_TEST_NAME,
} from "@synapse/db/lab-workflow"
import { hasDb } from "./test-db-guard"

describe.skipIf(!hasDb)("malaria golden journey — Postgres OPD triage → lab order", () => {
  let tenantId: string
  let patientId: string
  let clinicianId: string

  beforeAll(async () => {
    tenantId = crypto.randomUUID()
    patientId = crypto.randomUUID()
    clinicianId = crypto.randomUUID()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any

    const { error: tenantError } = await db.from("tenants").insert({
      id: tenantId,
      slug: tenantId,
      name: "Golden Journey Integration Hospital",
      facility_type: "hospital",
      is_synthetic: true,
      environment: "demo",
      data_classification: "synthetic",
    })
    if (tenantError) throw new Error(tenantError.message)

    const { error: hospitalError } = await db.from("hospitals").insert({
      id: tenantId,
      name: "Golden Journey Integration Hospital",
      subdomain: tenantId,
      facility_kind: "hospital",
      settings: { tenant_id: tenantId, is_synthetic: true },
    })
    if (hospitalError) throw new Error(hospitalError.message)

    const { error: profileError } = await db.from("profiles").insert({
      id: clinicianId,
      email: `${clinicianId}@golden-journey.invalid`,
      full_name: "Synthetic Clinician",
      first_name: "Synthetic",
      last_name: "Clinician",
      role: "doctor",
      tenant_id: tenantId,
      verification_status: "verified",
    })
    if (profileError) throw new Error(profileError.message)

    const { error: patientError } = await db.from("patients").insert({
      id: patientId,
      tenant_id: tenantId,
      mrn: `GJ-${Date.now()}`,
      full_name: "Amina Nalubega",
      dob: "1990-01-15",
      sex: "F",
    })
    if (patientError) throw new Error(patientError.message)
  })

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    await db.from("synapse_domain_events").delete().eq("tenant_id", tenantId)
    await db.from("department_tasks").delete().eq("tenant_id", tenantId)
    await db.from("lab_orders").delete().eq("tenant_id", tenantId)
    await db.from("encounters").delete().eq("tenant_id", tenantId)
    await db.from("patients").delete().eq("tenant_id", tenantId)
    await db.from("hospitals").delete().eq("id", tenantId)
    await db.from("profiles").delete().eq("id", clinicianId)
    await db.from("tenants").delete().eq("id", tenantId)
  })

  it("chains encounter → triage task → malaria lab order with shared correlation_id", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    const chiefComplaint = "Fever, chills, and headache for 3 days"

    const { data: encounter, error: encounterError } = await db
      .from("encounters")
      .insert({
        tenant_id: tenantId,
        patient_id: patientId,
        clinician_id: clinicianId,
        chief_complaint: chiefComplaint,
        status: "open",
        visit_date: new Date().toISOString(),
        is_deleted: false,
        is_synthetic: true,
      })
      .select("id")
      .single()

    if (encounterError) throw new Error(encounterError.message)

    const triageJourney = recordEncounterOpened({
      tenantId,
      hospitalId: tenantId,
      patientId,
      encounterId: encounter.id as string,
      requesterId: clinicianId,
      chiefComplaint,
      isSynthetic: true,
    })

    const triagePersist = await persistWorkQueueArtifactsBestEffort(db, {
      tasks: [triageJourney.triageTask],
      events: triageJourney.queue.outbox.list({ correlationId: encounter.id }),
    })
    expect(triagePersist.errors).toEqual([])

    const labJourney = recordLabOrderPlaced({
      tenantId,
      hospitalId: tenantId,
      patientId,
      encounterId: encounter.id as string,
      requesterId: clinicianId,
      loincCode: MALARIA_PF_ANTIGEN_LOINC,
      testName: MALARIA_PF_ANTIGEN_TEST_NAME,
      urgency: "URGENT",
      queue: triageJourney.queue,
      isSynthetic: true,
    })

    const orderPersist = await persistLabOrderBestEffort(db, labJourney.order)
    if (!orderPersist.ok) {
      console.error("[malaria-golden-journey] lab_orders persist failed", {
        table: "lab_orders",
        persistOk: false,
        error: orderPersist.error,
        hasTenant: Boolean(tenantId),
        hasEncounter: Boolean(encounter?.id),
        hasOrderId: Boolean(labJourney.order.id),
        loinc: labJourney.order.loincCode,
        workflowStatus: labJourney.order.status,
        correlationMatchesEncounter: labJourney.order.correlationId === encounter.id,
      })
    }
    expect(orderPersist.ok, orderPersist.ok ? "lab persist ok" : orderPersist.error).toBe(true)

    const labPersist = await persistWorkQueueArtifactsBestEffort(db, {
      tasks: [labJourney.labTask],
      events: labJourney.queue.outbox.list({ correlationId: encounter.id }),
    })
    expect(labPersist.errors).toEqual([])

    const { data: tasks } = await db
      .from("department_tasks")
      .select("task_type, owner_department, correlation_id")
      .eq("encounter_id", encounter.id)
      .order("created_at")

    expect(tasks?.map((t: { task_type: string }) => t.task_type)).toEqual(["triage", "lab_order"])
    expect(tasks?.[1]?.owner_department).toBe("laboratory")
    expect(tasks?.[0]?.correlation_id).toBe(encounter.id)

    const { data: order } = await db
      .from("lab_orders")
      .select("loinc_code, correlation_id, workflow_status")
      .eq("id", labJourney.order.id)
      .single()

    expect(order?.loinc_code).toBe(MALARIA_PF_ANTIGEN_LOINC)
    expect(order?.correlation_id).toBe(encounter.id)
    expect(order?.workflow_status).toBe("ORDERED")

    const { data: events } = await db
      .from("synapse_domain_events")
      .select("event_type, source")
      .eq("correlation_id", encounter.id)

    const eventTypes = (events ?? []).map((e: { event_type: string }) => e.event_type)
    expect(eventTypes).toContain("EncounterCreated")
    expect(eventTypes).toContain("LabOrderCreated")
    expect(
      (events ?? []).find((e: { event_type: string; source: string }) => e.event_type === "LabOrderCreated")
        ?.source,
    ).toBe("synapse-lab")
  })
})
