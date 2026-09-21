import { NextRequest, NextResponse } from "next/server"
import {
  assertCallerCannotSupplyTenant,
  assertNotForbidden,
  authorizePacketTenant,
  buildRecommendation,
  type PatientContextPacket,
} from "@synapse/interop"
import { suggestPathwaysFromContext } from "@synapse/db/pathways"
import { isContextError, gateHospitalModule } from "@/lib/hospital-shared"
import { requireHospitalStaffContext } from "@/lib/hospital-dept"

export const dynamic = "force-dynamic"

const SAFETY = "AI decision support only. Cannot activate a pathway, place an order, pronounce death, or certify death."

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const blocked = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, "clinical")
  if (blocked) return blocked
  const body = await req.json().catch(() => ({})) as {
    tenantId?: string
    forbiddenAction?: string
    packet?: PatientContextPacket
  }
  try {
    if (body.forbiddenAction) assertNotForbidden(body.forbiddenAction)
    assertCallerCannotSupplyTenant(body.tenantId, ctx.tenantId)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden"
    return NextResponse.json({ error: message, label: SAFETY }, { status: 403 })
  }
  const packet: PatientContextPacket = {
    ...(body.packet ?? {
      patientId: "unknown",
      tenantId: ctx.tenantId,
      clinicianId: ctx.userId,
      presentingComplaint: "undifferentiated",
    }),
    tenantId: ctx.tenantId,
    clinicianId: ctx.userId,
  }
  try {
    authorizePacketTenant(packet, ctx.tenantId)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Forbidden", label: SAFETY }, { status: 403 })
  }
  const recommendation = buildRecommendation({
    id: crypto.randomUUID(),
    task: "pathway_copilot",
    proposal: {
      conditionName: packet.presentingComplaint,
      cantMiss: /sepsis|stroke|haemorrh/i.test(packet.presentingComplaint),
      confidence: 0.45,
      aiReasoning: "Pathway suggestion only. Clinician chooses whether to activate.",
    },
    packet,
  })
  const suggested = suggestPathwaysFromContext({
    presentingComplaint: packet.presentingComplaint,
    vitals: packet.vitals,
    laboratory: packet.laboratory,
    diagnoses: packet.previousDiagnoses,
    countryPack: "UG",
  })
  return NextResponse.json({
    ok: true,
    label: SAFETY,
    recommendation,
    suggested,
    canActivate: false,
    canOrder: false,
  })
}
