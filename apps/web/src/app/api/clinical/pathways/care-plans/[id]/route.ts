import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@synapse/db/admin"
import { PathwayRuntime, assertClinicianPlacesOrder, type PatientCarePlan } from "@synapse/db/pathways"
import { isContextError, requireHospitalCapability, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  action: z.enum(["complete_step", "override", "complete_plan", "abandon", "place_order"]),
  step_id: z.string().optional(),
  actual_action: z.string().max(500).optional(),
  reason: z.string().max(500).optional(),
  outcome: z.string().max(240).optional(),
  actor_kind: z.enum(["clinician", "ai"]).default("clinician"),
})

function fromRow(row: Record<string, unknown>): PatientCarePlan {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    patientId: String(row.patient_id),
    personId: row.person_id ? String(row.person_id) : null,
    encounterId: String(row.encounter_id),
    pathwayId: String(row.pathway_id),
    pathwayVersion: String(row.pathway_version),
    sourceId: String(row.source_id),
    status: row.status as PatientCarePlan["status"],
    currentStepId: String(row.current_step_id),
    steps: row.steps as PatientCarePlan["steps"],
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    outcome: row.outcome ? String(row.outcome) : null,
    isSynthetic: Boolean(row.is_synthetic),
    simulationRunId: row.simulation_run_id ? String(row.simulation_run_id) : null,
    correlationId: String(row.correlation_id),
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "encounter", "create", "opd")
  if (cap) return cap
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data } = await db.from("patient_care_plans").select("*").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!data) return NextResponse.json({ error: "Care plan not found" }, { status: 404 })
  const plan = fromRow(data)
  if (plan.tenantId !== ctx.tenantId) return NextResponse.json({ error: "Care plan not found" }, { status: 404 })
  const runtime = new PathwayRuntime([plan])
  try {
    if (parsed.data.action === "place_order") {
      assertClinicianPlacesOrder({ kind: parsed.data.actor_kind })
      return NextResponse.json({ ok: true, placed: false, message: "Order proposal only. Clinician must confirm in orders." })
    }
    if (parsed.data.actor_kind === "ai") {
      return NextResponse.json({ error: "PATHWAY_AI_CANNOT_ACTIVATE" }, { status: 403 })
    }
    if (parsed.data.action === "complete_step") {
      runtime.completeStep({ carePlanId: id, stepId: parsed.data.step_id ?? plan.currentStepId, actualAction: parsed.data.actual_action })
    } else if (parsed.data.action === "override") {
      const result = runtime.overrideStep({
        overrideId: crypto.randomUUID(),
        carePlanId: id,
        stepId: parsed.data.step_id ?? plan.currentStepId,
        actualAction: parsed.data.actual_action ?? "",
        reason: parsed.data.reason ?? "",
        clinicianId: ctx.userId,
        patientContextReference: plan.encounterId,
      })
      await db.from("pathway_overrides").insert({
        id: result.override.id,
        tenant_id: ctx.tenantId,
        care_plan_id: result.plan.id,
        pathway_id: result.override.pathwayId,
        pathway_version: result.override.pathwayVersion,
        step_id: result.override.stepId,
        recommended_action: result.override.recommendedAction,
        actual_action: result.override.actualAction,
        reason: result.override.reason,
        clinician_id: ctx.userId,
        timestamp: result.override.timestamp,
        patient_context_reference: result.override.patientContextReference,
        may_train_models: false,
      })
    } else if (parsed.data.action === "complete_plan") {
      runtime.recordOutcome(id, parsed.data.outcome ?? "completed")
    } else {
      runtime.abandon(id, parsed.data.reason ?? "")
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: error instanceof Error && error.message.includes("AI") ? 403 : 400 })
  }
  const next = runtime.get(id)
  const { error } = await db.from("patient_care_plans").update({
    status: next.status,
    current_step_id: next.currentStepId,
    steps: next.steps,
    completed_at: next.completedAt ?? null,
    outcome: next.outcome ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("tenant_id", ctx.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logHospitalAudit({ ctx, action: "UPDATE", tableName: "patient_care_plans", recordId: id, newValue: { action: parsed.data.action, status: next.status } })
  return NextResponse.json({ carePlan: next })
}
