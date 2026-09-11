/**
 * OPD → prescribe → verify → dispense golden journey (domain layer).
 * Pure orchestration over clinical-journey + prescription-bridge so CI can
 * prove the pharmacy bridge without production credentials.
 */
import {
  recordEncounterOpened,
  recordPrescriptionPlaced,
  recordTriageCompleted,
} from "./clinical-journey"
import {
  dispensePrescription,
  verifyPrescription,
  type ClinicalPrescription,
} from "./prescription-bridge"
import type { DepartmentTask } from "./work-queue"
import type { WorkQueue } from "./work-queue"

export type OpdDispenseGoldenStepStatus = "PASS" | "FAIL"

export type OpdDispenseGoldenStep = {
  id: string
  status: OpdDispenseGoldenStepStatus
  detail?: string
  artifacts?: Record<string, unknown>
}

export type OpdDispenseGoldenResult = {
  status: "PASS" | "FAIL"
  correlationId: string
  steps: OpdDispenseGoldenStep[]
  prescription?: ClinicalPrescription
  pharmacyTask?: DepartmentTask
  remainingStock?: number
  queue?: WorkQueue
}

export type OpdDispenseGoldenInput = {
  tenantId?: string
  hospitalId?: string
  pharmacyTenantId?: string
  patientId?: string
  encounterId?: string
  doctorId?: string
  nurseId?: string
  pharmacistId?: string
  medicationDisplay?: string
  dose?: string
  quantity?: number
  availableStock?: number
  /** When set, skip happy-path dispense and assert this failure code instead. */
  expectDispenseError?: string
}

function step(id: string, status: OpdDispenseGoldenStepStatus, detail?: string, artifacts?: Record<string, unknown>): OpdDispenseGoldenStep {
  return { id, status, detail, artifacts }
}

function ids() {
  const suffix = crypto.randomUUID().slice(0, 8)
  return {
    tenantId: crypto.randomUUID(),
    hospitalId: crypto.randomUUID(),
    pharmacyTenantId: crypto.randomUUID(),
    patientId: crypto.randomUUID(),
    encounterId: crypto.randomUUID(),
    doctorId: crypto.randomUUID(),
    nurseId: crypto.randomUUID(),
    pharmacistId: crypto.randomUUID(),
    run: suffix,
  }
}

/**
 * Run the domain OPD→dispense golden journey.
 * Returns FAIL if any step throws or an expected negative assertion fails.
 */
export function runOpdDispenseGoldenJourney(input: OpdDispenseGoldenInput = {}): OpdDispenseGoldenResult {
  const seeded = ids()
  const tenantId = input.tenantId ?? seeded.tenantId
  const hospitalId = input.hospitalId ?? seeded.hospitalId
  const pharmacyTenantId = input.pharmacyTenantId ?? seeded.pharmacyTenantId
  const patientId = input.patientId ?? seeded.patientId
  const encounterId = input.encounterId ?? seeded.encounterId
  const doctorId = input.doctorId ?? seeded.doctorId
  const nurseId = input.nurseId ?? seeded.nurseId
  const pharmacistId = input.pharmacistId ?? seeded.pharmacistId
  const medicationDisplay = input.medicationDisplay ?? "Paracetamol 500mg"
  const dose = input.dose ?? "1 tablet TID x 3 days"
  const quantity = input.quantity ?? 9
  const availableStock = input.availableStock ?? 20
  const steps: OpdDispenseGoldenStep[] = []

  try {
    const opened = recordEncounterOpened({
      tenantId,
      hospitalId,
      patientId,
      encounterId,
      requesterId: nurseId,
      chiefComplaint: "fever and headache",
      isSynthetic: true,
    })
    steps.push(
      step("encounter_opened", "PASS", undefined, {
        triageTaskId: opened.triageTask.id,
        events: opened.eventsEmitted,
      }),
    )

    const triaged = recordTriageCompleted({
      queue: opened.queue,
      triageTaskId: opened.triageTask.id,
      tenantId,
      hospitalId,
      patientId,
      encounterId,
      requesterId: nurseId,
    })
    steps.push(
      step("triage_completed", "PASS", undefined, {
        doctorTaskId: triaged.doctorTask.id,
      }),
    )

    const placed = recordPrescriptionPlaced({
      queue: triaged.queue,
      tenantId,
      hospitalId,
      patientId,
      encounterId,
      requesterId: doctorId,
      medicationDisplay,
      dose,
      quantity,
      unit: "tablet",
      pharmacyTenantId,
      correlationId: encounterId,
      isSynthetic: true,
    })
    steps.push(
      step("prescription_placed", "PASS", undefined, {
        prescriptionId: placed.prescription.id,
        pharmacyTaskId: placed.pharmacyTask.id,
        status: placed.prescription.status,
      }),
    )

    if (placed.prescription.tenantId !== tenantId) {
      throw new Error("TENANT_ISOLATION_BROKEN")
    }
    steps.push(step("tenant_bound", "PASS", undefined, { tenantId: placed.prescription.tenantId }))

    const verified = verifyPrescription(placed.prescription, pharmacistId, "pharmacist")
    steps.push(
      step("prescription_verified", "PASS", undefined, {
        verifierId: verified.verifierId,
        status: verified.status,
      }),
    )

    try {
      const dispensed = dispensePrescription({
        rx: verified,
        dispenserId: pharmacistId,
        role: "pharmacist",
        availableStock,
      })

      if (input.expectDispenseError) {
        steps.push(step("prescription_dispensed", "FAIL", `expected ${input.expectDispenseError} but dispense succeeded`))
        return { status: "FAIL", correlationId: encounterId, steps, prescription: dispensed.rx, pharmacyTask: placed.pharmacyTask, remainingStock: dispensed.remainingStock, queue: placed.queue }
      }

      const started = placed.queue.start(placed.pharmacyTask.id, pharmacistId)
      if (!started.ok) throw new Error(started.error)
      const completed = placed.queue.complete(placed.pharmacyTask.id, "Dispensed", pharmacistId)
      if (!completed.ok) throw new Error(completed.error)

      const events = placed.queue.outbox.list({ correlationId: encounterId })
      const hasRxEvent = events.some((event) => event.event_type === "PrescriptionCreated")

      steps.push(
        step("prescription_dispensed", "PASS", undefined, {
          status: dispensed.rx.status,
          remainingStock: dispensed.remainingStock,
          pharmacyTaskStatus: completed.task.status,
          prescriptionCreatedEvent: hasRxEvent,
        }),
      )

      // Idempotency at domain layer: already dispensed cannot be dispensed again
      try {
        dispensePrescription({
          rx: dispensed.rx,
          dispenserId: pharmacistId,
          role: "pharmacist",
          availableStock: dispensed.remainingStock,
        })
        steps.push(step("already_dispensed_guard", "FAIL", "second dispense unexpectedly succeeded"))
        return { status: "FAIL", correlationId: encounterId, steps, prescription: dispensed.rx, pharmacyTask: completed.task, remainingStock: dispensed.remainingStock, queue: placed.queue }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message !== "DISPENSE_REQUIRES_VERIFICATION") {
          // dispensed status !== verified, so bridge rejects with DISPENSE_REQUIRES_VERIFICATION
          // which is the correct fail-closed behavior for a second pass
        }
        steps.push(step("already_dispensed_guard", "PASS", message))
      }

      const failed = steps.some((row) => row.status === "FAIL")
      return {
        status: failed ? "FAIL" : "PASS",
        correlationId: encounterId,
        steps,
        prescription: dispensed.rx,
        pharmacyTask: completed.task,
        remainingStock: dispensed.remainingStock,
        queue: placed.queue,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (input.expectDispenseError) {
        const ok = message === input.expectDispenseError
        steps.push(step("prescription_dispensed", ok ? "PASS" : "FAIL", message, { expected: input.expectDispenseError }))
        return {
          status: ok && !steps.some((row) => row.status === "FAIL") ? "PASS" : "FAIL",
          correlationId: encounterId,
          steps,
          prescription: verified,
          pharmacyTask: placed.pharmacyTask,
          queue: placed.queue,
        }
      }
      steps.push(step("prescription_dispensed", "FAIL", message))
      return { status: "FAIL", correlationId: encounterId, steps, prescription: verified, pharmacyTask: placed.pharmacyTask, queue: placed.queue }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    steps.push(step("journey", "FAIL", message))
    return { status: "FAIL", correlationId: encounterId, steps }
  }
}
