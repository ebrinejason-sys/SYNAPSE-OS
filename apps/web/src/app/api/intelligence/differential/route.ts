import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import {
  assertCallerCannotSupplyTenant,
  authorizePacketTenant,
  buildRecommendation,
  recordClinicianDecision,
  type ClinicianDecision,
  type PatientContextPacket,
} from "@synapse/interop"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 403 })

  const body = (await req.json()) as {
    tenantId?: string
    presentingComplaint?: string
    proposedTerm?: string
    decision?: ClinicianDecision
    recommendationId?: string
    reason?: string
    packet?: Partial<PatientContextPacket>
  }

  try {
    assertCallerCannotSupplyTenant(body.tenantId, user.tenantId)
  } catch {
    return NextResponse.json({ error: "Caller-supplied tenantId is not accepted" }, { status: 403 })
  }

  const packet: PatientContextPacket = {
    patientId: body.packet?.patientId ?? "session",
    tenantId: user.tenantId,
    encounterId: body.packet?.encounterId ?? null,
    clinicianId: user.id,
    presentingComplaint: body.presentingComplaint ?? body.packet?.presentingComplaint ?? "",
    vitals: body.packet?.vitals,
    laboratory: body.packet?.laboratory,
    medications: body.packet?.medications,
    allergies: body.packet?.allergies,
    history: body.packet?.history,
  }
  authorizePacketTenant(packet, user.tenantId)

  if (body.decision && body.recommendationId) {
    try {
      const action = recordClinicianDecision({
        recommendationId: body.recommendationId,
        decision: body.decision,
        clinicianId: user.id,
        reason: body.reason,
      })
      return NextResponse.json({ action })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid clinician action" },
        { status: 400 },
      )
    }
  }

  if (!body.proposedTerm && !packet.presentingComplaint) {
    return NextResponse.json({ error: "presentingComplaint or proposedTerm is required" }, { status: 400 })
  }

  const recommendation = buildRecommendation({
    id: "rec-kernel-1",
    task: "clinical_copilot",
    packet,
    proposal: {
      conditionName: body.proposedTerm ?? packet.presentingComplaint,
      icd11Code: "MUST_BE_STRIPPED",
      confidence: 0.5,
    },
    model: null,
  })

  return NextResponse.json({ recommendation })
}
