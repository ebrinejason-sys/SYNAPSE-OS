import { NextRequest, NextResponse } from "next/server"
import {
  INTELLIGENCE_TASKS,
  assertCallerCannotSupplyTenant,
  assertNotForbidden,
  authorizePacketTenant,
  buildRecommendation,
  contextSummary,
  type IntelligenceTask,
  type PatientContextPacket,
} from "@synapse/interop"
import {
  completeOpenRouterChat,
  isOpenRouterConfigured,
  resolveOpenRouterModels,
} from "../../../../lib/ai/openrouter"
import { checkRateLimit, rateLimiters } from "../../../../lib/rate-limit"

export const runtime = "nodejs"

const DEMO_SYNTHETIC_TENANT = "demo-hospital"
const SAFETY_LABEL = "AI-generated decision support. Synthetic demonstration data. Requires qualified human review."

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
  if (task === "coding_copilot") {
    return {
      conditionName: /fever|malaria/i.test(hay) ? "malaria" : packet.presentingComplaint || "clinical finding",
      cantMiss: false,
      confidence: 0.5,
      aiReasoning: "Synthetic fallback terminology suggestion. ICD-11 candidates come from the terminology service, not the model.",
    }
  }
  if (task === "pathway_copilot") {
    return {
      conditionName: /fever|malaria/i.test(hay) ? "malaria" : /sepsis|tachycardia/i.test(hay) ? "sepsis" : "undifferentiated acute illness",
      cantMiss: /sepsis|fever/i.test(hay),
      confidence: 0.48,
      aiReasoning: "Synthetic fallback pathway suggestion. AI cannot start a pathway.",
    }
  }
  return {
    conditionName: /fever|malaria/i.test(hay) ? "malaria" : "undifferentiated acute illness",
    cantMiss: /fever|sepsis|neck stiffness/i.test(hay),
    confidence: 0.52,
    aiReasoning: "Synthetic fallback decision support. Consider endemic infections and cannot-miss complications. This is not a diagnosis.",
  }
}

function parseLiveProposal(content: string) {
  try {
    const json = JSON.parse(content) as {
      conditionName?: string
      cantMiss?: boolean
      confidence?: number
      aiReasoning?: string
    }
    if (!json.conditionName?.trim()) return null
    return {
      conditionName: json.conditionName.trim(),
      cantMiss: Boolean(json.cantMiss),
      confidence: Number(json.confidence) || 0.4,
      aiReasoning: json.aiReasoning?.trim() || `Consider ${json.conditionName.trim()} given the recorded context.`,
    }
  } catch {
    return null
  }
}

async function liveProposal(task: IntelligenceTask, packet: PatientContextPacket) {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  if (!isOpenRouterConfigured() || !key) return null
  const result = await completeOpenRouterChat({
    apiKey: key,
    models: resolveOpenRouterModels(),
    jsonMode: true,
    timeoutMs: 8_000,
    title: "Synapse Demo Intelligence",
    referer: "https://demo.synapseos.tech",
    messages: [
      {
        role: "system",
        content: `You are SYNAPSE clinical decision support. Task=${task}. Return ONLY JSON {"conditionName":string,"cantMiss":boolean,"confidence":number,"aiReasoning":string}. Advisory only. Do not invent ICD-11 codes. Do not claim a diagnosis, verify a lab, dispense, or sign.`,
      },
      { role: "user", content: contextSummary(packet) },
    ],
  })
  if (!result.ok) return null
  const proposal = parseLiveProposal(result.content)
  if (!proposal) return null
  return { proposal, provider: "openrouter" as const, model: result.model }
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
    const live = await liveProposal(task, packet)
    const provider = live?.provider ?? "synthetic-fallback"
    const model = live?.model ?? "synthetic-fallback"
    const recommendation = buildRecommendation({
      id: crypto.randomUUID(),
      task,
      proposal: live?.proposal ?? syntheticProposal(task, packet),
      packet,
      model,
    })
    return NextResponse.json({
      ok: true,
      isolated: true,
      provider,
      fallback: provider === "synthetic-fallback",
      label: SAFETY_LABEL,
      recommendation,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI assistance unavailable"
    const status = message.startsWith("INTELLIGENCE_FORBIDDEN") || message === "CALLER_TENANT_REJECTED" || message === "TENANT_MISMATCH" ? 403 : 400
    return NextResponse.json({ error: message, isolated: true }, { status })
  }
}
