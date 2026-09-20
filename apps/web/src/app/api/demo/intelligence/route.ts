import { NextRequest, NextResponse } from "next/server"
import {
  INTELLIGENCE_TASKS,
  assertCallerCannotSupplyTenant,
  assertNotForbidden,
  authorizePacketTenant,
  buildRecommendation,
  type IntelligenceTask,
  type PatientContextPacket,
} from "@synapse/interop"
import { checkRateLimit, rateLimiters } from "../../../../lib/rate-limit"

export const runtime = "nodejs"

const DEMO_SYNTHETIC_TENANT = "demo-hospital"

function isTask(value: string): value is IntelligenceTask {
  return (INTELLIGENCE_TASKS as readonly string[]).includes(value)
}

function syntheticProposal(task: IntelligenceTask, packet: PatientContextPacket) {
  const hay = [packet.presentingComplaint, ...(packet.laboratory ?? []).map((row) => `${row.test} ${row.value}`)].join(" ")
  if (task === "lab_interpretation") {
    return {
      conditionName: /wbc|leuk/i.test(hay) ? "leukocytosis pattern" : "lab pattern review",
      cantMiss: /17\.|critical|panic/i.test(hay),
      confidence: 0.55,
      aiReasoning: "Synthetic fallback only. May be consistent with infection, inflammation, or stress response. Human verification required.",
    }
  }
  return {
    conditionName: /fever|malaria/i.test(hay) ? "malaria" : "undifferentiated acute illness",
    cantMiss: /fever|sepsis|neck stiffness/i.test(hay),
    confidence: 0.52,
    aiReasoning: "Synthetic fallback decision support. Consider endemic infections and cannot-miss complications. This is not a diagnosis.",
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "demo"
  const rate = await checkRateLimit(rateLimiters.demoAi, `demo-intelligence:${ip}`)
  if (!rate.success) {
    return NextResponse.json({ error: "AI assistance unavailable" }, { status: 429 })
  }

  const body = await req.json().catch(() => ({})) as {
    task?: string
    tenantId?: string
    packet?: PatientContextPacket
    forbiddenAction?: string
  }

  try {
    if (body.forbiddenAction) assertNotForbidden(body.forbiddenAction)
    assertCallerCannotSupplyTenant(body.tenantId, DEMO_SYNTHETIC_TENANT)
    const task = isTask(String(body.task ?? "clinical_copilot")) ? (body.task as IntelligenceTask) : "clinical_copilot"
    const packet: PatientContextPacket = {
      ...(body.packet ?? { patientId: "demo-person-amina", tenantId: DEMO_SYNTHETIC_TENANT, clinicianId: "doctor-demo", presentingComplaint: "Fever" }),
      tenantId: DEMO_SYNTHETIC_TENANT,
    }
    authorizePacketTenant(packet, DEMO_SYNTHETIC_TENANT)
    const recommendation = buildRecommendation({
      id: crypto.randomUUID(),
      task,
      proposal: syntheticProposal(task, packet),
      packet,
      model: "synthetic-fallback",
    })
    return NextResponse.json({
      ok: true,
      isolated: true,
      provider: "synthetic-fallback",
      label: "AI-generated decision support. Synthetic demonstration data. Requires qualified human review.",
      recommendation,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI assistance unavailable"
    const status = message.startsWith("INTELLIGENCE_FORBIDDEN") || message === "CALLER_TENANT_REJECTED" || message === "TENANT_MISMATCH" ? 403 : 400
    return NextResponse.json({ error: message, isolated: true }, { status })
  }
}
