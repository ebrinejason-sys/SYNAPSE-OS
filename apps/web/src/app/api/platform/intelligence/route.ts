import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requirePlatformAdminApi } from "@/lib/platform/auth";
import { getProductionTruth } from "@/lib/platform/production-truth";
import {
  buildRecommendation,
  type PatientContextPacket,
} from "@synapse/interop";

export const dynamic = "force-dynamic";

function providerConfigured(key: string | undefined): "NOT_CONFIGURED" | "CONFIGURED" {
  return key?.trim() ? "CONFIGURED" : "NOT_CONFIGURED";
}

export async function GET() {
  const auth = await requirePlatformAdminApi();
  if (!auth.ok) return auth.response;

  const truth = await getProductionTruth();
  const db = createServiceClient() as any;

  const { data: aiRows, error } = await db
    .from("ai_call_logs")
    .select("latency_ms, success, created_at, provider")
    .order("created_at", { ascending: false })
    .limit(100);

  const sample = aiRows ?? [];
  const successRate = sample.length
    ? Math.round((sample.filter((row: { success?: boolean }) => row.success).length / sample.length) * 100)
    : null;
  const avgLatency = sample.length
    ? Math.round(
        sample.reduce((sum: number, row: { latency_ms?: number }) => sum + (row.latency_ms ?? 0), 0) /
          sample.length
      )
    : null;

  return NextResponse.json({
    providers: {
      openRouter: {
        configured: truth.openRouter.status !== "NOT_CONFIGURED",
        status: truth.openRouter.status,
        detail: truth.openRouter.detail,
        lastProbeMs: truth.openRouter.latencyMs ?? null,
      },
      gemini: {
        configured: providerConfigured(process.env.GEMINI_API_KEY) === "CONFIGURED",
        status: providerConfigured(process.env.GEMINI_API_KEY),
        detail: process.env.GEMINI_API_KEY
          ? "API key present — no live probe wired"
          : "No GEMINI_API_KEY",
      },
      deepseek: {
        configured: providerConfigured(process.env.DEEPSEEK_API_KEY) === "CONFIGURED",
        status: providerConfigured(process.env.DEEPSEEK_API_KEY),
        detail: process.env.DEEPSEEK_API_KEY
          ? "API key present — no live probe wired"
          : "No DEEPSEEK_API_KEY",
      },
    },
    metrics: error
      ? { available: false, detail: "ai_call_logs unavailable" }
      : {
          available: sample.length > 0,
          sampleSize: sample.length,
          successRate,
          avgLatencyMs: avgLatency,
          lastCallAt: sample[0]?.created_at ?? null,
        },
    checkedAt: truth.checkedAt,
  });
}

export async function POST() {
  const auth = await requirePlatformAdminApi();
  if (!auth.ok) return auth.response;

  const packet: PatientContextPacket = {
    patientId: "synthetic-eval-malaria",
    tenantId: "synthetic-eval",
    encounterId: "eval-enc-1",
    clinicianId: auth.profile.id,
    demographics: { age: 28, sex: "F", display: "Synthetic malaria eval" },
    presentingComplaint: "Fever, chills and headache for 3 days",
    vitals: { temperature_c: 39.1, heart_rate: 118, spo2: 96 },
    laboratory: [],
    guidelineContext: "UCG malaria",
  };

  const recommendation = buildRecommendation({
    id: `eval-${crypto.randomUUID()}`,
    task: "clinical_copilot",
    packet,
    proposal: {
      conditionName: "Malaria due to Plasmodium falciparum",
      icd11Code: "FAKECODE",
      cantMiss: true,
      confidence: 0.72,
      aiReasoning: "Synthetic eval — invented ICD must be stripped.",
    },
  });

  const malariaMentioned =
    recommendation.proposedTerms.some((term) => term.toLowerCase().includes("malaria")) ||
    recommendation.recommendation.toLowerCase().includes("malaria");
  const inventedIcdStripped = !recommendation.icd11Candidates.some((hit) => hit.stemCode === "FAKECODE");
  const pass = malariaMentioned && inventedIcdStripped;

  return NextResponse.json({
    status: pass ? "PASS" : "FAIL",
    malariaMentioned,
    inventedIcdStripped,
    suggestedPathwayId: recommendation.suggestedPathwayId,
    icd11Candidates: recommendation.icd11Candidates.slice(0, 3).map((hit) => ({
      stemCode: hit.stemCode,
      title: hit.title,
    })),
    isSynthetic: true,
    checkedAt: new Date().toISOString(),
  });
}
