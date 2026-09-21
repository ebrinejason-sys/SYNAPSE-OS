import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@synapse/db/admin"
import {
  PathwayRuntime,
  assertClinicianActivatesPathway,
  getPathway,
  instantiateCarePlan,
} from "@synapse/db/pathways"
import { isContextError, requireHospitalCapability, logHospitalAudit } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  patient_id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  person_id: z.string().uuid().optional(),
  pathway_id: z.string().min(1),
  pathway_version: z.string().optional(),
  actor_kind: z.enum(["clinician", "ai"]).default("clinician"),
})

function planToRow(plan: ReturnType<typeof instantiateCarePlan>) {
  return {
    id: plan.id,
    tenant_id: plan.tenantId,
    patient_id: plan.patientId,
    person_id: plan.personId ?? null,
    encounter_id: plan.encounterId,
    pathway_id: plan.pathwayId,
    pathway_version: plan.pathwayVersion,
    source_id: plan.sourceId,
    status: plan.status,
    current_step_id: plan.currentStepId,
    steps: plan.steps,
    started_at: plan.startedAt,
    completed_at: plan.completedAt ?? null,
    outcome: plan.outcome ?? null,
    is_synthetic: plan.isSynthetic,
    simulation_run_id: plan.simulationRunId ?? null,
    correlation_id: plan.correlationId,
  }
}

export async function GET(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "encounter", "create", "opd")
  if (cap) return cap
  const encounterId = req.nextUrl.searchParams.get("encounter_id")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  let query = db.from("patient_care_plans").select("*").eq("tenant_id", ctx.tenantId).order("started_at", { ascending: false }).limit(50)
  if (encounterId) query = query.eq("encounter_id", encounterId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ carePlans: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const cap = await requireHospitalCapability(ctx, "encounter", "create", "opd")
  if (cap) return cap
  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    assertClinicianActivatesPathway({ kind: parsed.data.actor_kind })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Forbidden" }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter } = await db.from("encounters").select("id, patient_id").eq("id", parsed.data.encounter_id).eq("tenant_id", ctx.tenantId).maybeSingle()
  if (!encounter || encounter.patient_id !== parsed.data.patient_id) {
    return NextResponse.json({ error: "Encounter not found for patient" }, { status: 404 })
  }
  try {
    const pathway = getPathway(parsed.data.pathway_id, parsed.data.pathway_version)
    const plan = instantiateCarePlan({
      id: crypto.randomUUID(),
      tenantId: ctx.tenantId,
      patientId: parsed.data.patient_id,
      personId: parsed.data.person_id ?? null,
      encounterId: parsed.data.encounter_id,
      pathway,
      correlationId: crypto.randomUUID(),
    })
    const runtime = new PathwayRuntime()
    runtime.start(plan)
    const { error } = await db.from("patient_care_plans").insert(planToRow(plan))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logHospitalAudit({ ctx, action: "INSERT", tableName: "patient_care_plans", recordId: plan.id, newValue: { pathwayId: plan.pathwayId, version: plan.pathwayVersion } })
    return NextResponse.json({ carePlan: plan, proposedOrders: pathway.steps.flatMap((step) => step.orderSet ?? []) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Activation failed" }, { status: 400 })
  }
}
