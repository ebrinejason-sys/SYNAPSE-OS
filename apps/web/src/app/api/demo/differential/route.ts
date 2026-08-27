import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { parseClinicalDemoResponse } from "../../../../lib/ai/clinical-json";
import {
  completeOpenRouterChat,
  isOpenRouterConfigured,
  publicOpenRouterError,
  resolveOpenRouterModels,
} from "../../../../lib/ai/openrouter";
import { checkRateLimit, rateLimiters } from "../../../../lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

type DemoBody = {
  chiefComplaint: string;
  age?: number;
  sex?: string;
  vitals?: Record<string, number>;
  requestFollowUp?: boolean;
  duration?: string;
  pregnancy?: string;
  pastHistory?: string;
  allergies?: string;
  medications?: string;
  riskNotes?: string;
};

type ProviderResult = {
  data: ReturnType<typeof parseClinicalDemoResponse>;
  provider: string;
  model: string;
};

type ProviderFailure = {
  provider: string;
  reason: string;
};

function optionalLine(label: string, value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : `${label}: not provided`;
}

const CLINICAL_PROMPT = (
  chiefComplaint: string,
  age: number | undefined,
  sex: string | undefined,
  vitalsText: string,
  withFollowUp: boolean,
  extras: {
    duration?: string;
    pregnancy?: string;
    pastHistory?: string;
    allergies?: string;
    medications?: string;
    riskNotes?: string;
  }
) =>
  `You are a clinical decision support AI for hospitals in Uganda and East Africa.

Patient: ${age ?? "?"} year old ${sex ?? "unknown"}
Chief Complaint: "${chiefComplaint}"
${optionalLine("Duration", extras.duration)}
${optionalLine("Pregnancy status", extras.pregnancy)}
${optionalLine("Past medical history", extras.pastHistory)}
${optionalLine("Allergies", extras.allergies)}
${optionalLine("Current medications", extras.medications)}
${optionalLine("Other risk notes (travel, contacts, chronic illness)", extras.riskNotes)}
Vitals: ${vitalsText}

Return ONLY valid JSON. No markdown. No preamble.
{
  "differentials": [
    {
      "condition": "string",
      "icd11_code": "string or null",
      "confidence": "high|medium|low",
      "rationale": "one sentence",
      "key_features": "brief distinguishing features"
    }
  ],
  "suggested_workup": ["test name"],
  "red_flags": ["flag"],
  "clinical_note": "one sentence summary",
  "ucg_reference": "string or null"${withFollowUp ? ',\n  "follow_up_questions": ["targeted question that would most reduce diagnostic uncertainty"]' : ""}
}

${withFollowUp ? "Include exactly 3 follow_up_questions that would most sharpen the differential (travel, sick contacts, pregnancy, meds, etc.). " : ""}Use all provided history when ranking differentials. Prioritise East African endemic diseases. Prefer tests available at district hospital level. Max 5 differentials.`;

const SYSTEM_PROMPT =
  "You are a clinical decision-support assistant. Reply with a single JSON object only. Never wrap it in markdown. Never include chain-of-thought.";

async function tryOpenRouter(prompt: string): Promise<ProviderResult | ProviderFailure | null> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;

  const models = resolveOpenRouterModels();
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: prompt },
  ];
  const referer = process.env.NEXT_PUBLIC_APP_URL ?? "https://synapseos.tech";

  const withJson = await completeOpenRouterChat({
    apiKey: key,
    messages,
    models,
    referer,
    jsonMode: true,
  });

  if (withJson.ok) {
    try {
      return { data: parseClinicalDemoResponse(withJson.content), provider: "openrouter", model: withJson.model };
    } catch (error) {
      console.warn("[demo/differential] OpenRouter JSON parse failed", error instanceof Error ? error.message : error);
    }
  } else {
    console.warn("[demo/differential] OpenRouter json-mode failed", withJson.status, withJson.message);
    if (withJson.status === 401 || withJson.status === 403 || withJson.status === 402 || withJson.status === 429) {
      return { provider: "openrouter", reason: publicOpenRouterError(withJson) };
    }
  }

  const withoutJson = await completeOpenRouterChat({
    apiKey: key,
    messages,
    models,
    referer,
    jsonMode: false,
  });

  if (withoutJson.ok) {
    try {
      return { data: parseClinicalDemoResponse(withoutJson.content), provider: "openrouter", model: withoutJson.model };
    } catch (error) {
      return {
        provider: "openrouter",
        reason: error instanceof Error ? error.message : "invalid JSON from OpenRouter",
      };
    }
  }

  return {
    provider: "openrouter",
    reason: publicOpenRouterError(withoutJson),
  };
}

async function tryGemini(prompt: string): Promise<ProviderResult | ProviderFailure | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  try {
    const genAI = new GoogleGenAI({ apiKey: key });
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    return {
      data: parseClinicalDemoResponse(result.text ?? ""),
      provider: "gemini",
      model: "gemini-2.0-flash",
    };
  } catch (error) {
    console.warn("[demo/differential] Gemini failed", error instanceof Error ? error.message : error);
    return { provider: "gemini", reason: "Gemini did not return a usable response." };
  }
}

async function tryDeepSeekDirect(prompt: string): Promise<ProviderResult | ProviderFailure | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      return { provider: "deepseek", reason: `DeepSeek HTTP ${res.status}` };
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return {
      data: parseClinicalDemoResponse(json.choices?.[0]?.message?.content ?? ""),
      provider: "deepseek",
      model: "deepseek-chat",
    };
  } catch (error) {
    console.warn("[demo/differential] DeepSeek failed", error instanceof Error ? error.message : error);
    return { provider: "deepseek", reason: "DeepSeek did not return a usable response." };
  }
}

function isResult(value: ProviderResult | ProviderFailure | null): value is ProviderResult {
  return Boolean(value && "data" in value);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await checkRateLimit(rateLimiters.demoAi, ip);
  if (!success) {
    return NextResponse.json(
      { error: "Demo rate limit exceeded. Try again in an hour." },
      { status: 429 }
    );
  }

  const body = (await req.json()) as DemoBody;
  const {
    chiefComplaint,
    age,
    sex,
    vitals,
    requestFollowUp,
    duration,
    pregnancy,
    pastHistory,
    allergies,
    medications,
    riskNotes,
  } = body;

  if (!chiefComplaint) {
    return NextResponse.json({ error: "chiefComplaint is required" }, { status: 400 });
  }

  const vitalsText = vitals
    ? `Temp: ${vitals.temperature_c ?? "?"}°C, HR: ${vitals.heart_rate ?? "?"}, BP: ${vitals.bp_systolic ?? "?"}/${vitals.bp_diastolic ?? "?"}, SpO2: ${vitals.spo2 ?? "?"}%`
    : "not recorded";

  const prompt = CLINICAL_PROMPT(
    chiefComplaint,
    age,
    sex,
    vitalsText,
    Boolean(requestFollowUp),
    { duration, pregnancy, pastHistory, allergies, medications, riskNotes }
  );

  const configured = {
    openrouter: isOpenRouterConfigured(),
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
  };

  if (!configured.openrouter && !configured.gemini && !configured.deepseek) {
    return NextResponse.json(
      { error: "Clinical demo is not configured. Set OPENROUTER_API_KEY on the server." },
      { status: 503 }
    );
  }

  const failures: ProviderFailure[] = [];
  for (const attempt of [tryOpenRouter, tryGemini, tryDeepSeekDirect]) {
    const outcome = await attempt(prompt);
    if (isResult(outcome)) {
      return NextResponse.json({
        ...outcome.data,
        ai_provider: outcome.provider,
        ai_model: outcome.model,
      });
    }
    if (outcome) failures.push(outcome);
  }

  const publicReason = failures[0]?.reason ?? "All AI providers unavailable. Please try again later.";
  console.error("[demo/differential] all providers failed", failures);

  return NextResponse.json({ error: publicReason }, { status: 503 });
}
