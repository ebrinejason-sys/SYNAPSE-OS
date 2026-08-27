import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, rateLimiters } from "../../../../lib/rate-limit"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"
import {
  assertCallerCannotSupplyTenant,
  authorizePacketTenant,
  buildRecommendation,
  stripInventedIcdCodes,
  type PatientContextPacket,
} from "@synapse/interop"
import { generateDifferential } from "@/lib/reasoning/ai"

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: "Tenant context required" }, { status: 403 })

  const ip = req.headers.get("x-forwarded-for") ?? "unknown"
  const { success } = await checkRateLimit(rateLimiters.ai, ip)
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  const body = (await req.json()) as {
    chiefComplaint?: string
    vitals?: PatientContextPacket["vitals"]
    age?: number
    sex?: string
    encounterId?: string
    tenantId?: string
    history?: string[]
    examination?: string[]
    medications?: string[]
    allergies?: string[]
    laboratory?: PatientContextPacket["laboratory"]
  }

  try {
    assertCallerCannotSupplyTenant(body.tenantId, user.tenantId)
  } catch {
    return NextResponse.json({ error: "Caller-supplied tenantId is not accepted" }, { status: 403 })
  }

  if (!body.chiefComplaint) {
    return NextResponse.json({ error: "chiefComplaint is required" }, { status: 400 })
  }

  const packet: PatientContextPacket = {
    patientId: "session",
    tenantId: user.tenantId,
    encounterId: body.encounterId ?? null,
    clinicianId: user.id,
    demographics: { age: body.age ?? null, sex: body.sex ?? null },
    presentingComplaint: body.chiefComplaint,
    history: body.history,
    examination: body.examination,
    vitals: body.vitals,
    medications: body.medications,
    allergies: body.allergies,
    laboratory: body.laboratory,
  }
  authorizePacketTenant(packet, user.tenantId)

  const proposal = await generateDifferential({
    chiefComplaint: body.chiefComplaint,
    evidence: [],
    age: body.age,
    sex: body.sex,
    vitals: body.vitals
      ? {
          temperature_c: Number(body.vitals.temperature_c ?? body.vitals.temp),
          heart_rate: Number(body.vitals.heart_rate ?? body.vitals.hr),
          bp_systolic: Number(body.vitals.bp_systolic ?? body.vitals.sbp),
          bp_diastolic: Number(body.vitals.bp_diastolic ?? body.vitals.dbp),
          spo2: Number(body.vitals.spo2),
        }
      : undefined,
  })

  const recommendations = proposal.hypotheses.map((hypothesis, index) =>
    buildRecommendation({
      id: `rec-${index + 1}`,
      task: "clinical_copilot",
      packet,
      proposal: stripInventedIcdCodes(hypothesis),
      model: "gemini-2.0-flash",
    }),
  )

  return NextResponse.json({
    recommendations,
    suggestedWorkup: proposal.suggestedWorkup,
    redFlags: proposal.redFlags,
    clinicalNote: proposal.clinicalNote,
    ucgReference: proposal.ucgReference,
    promptVersion: recommendations[0]?.provenance.promptVersion ?? null,
  })
}
