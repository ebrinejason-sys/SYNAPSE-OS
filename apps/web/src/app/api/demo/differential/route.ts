import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimiters } from "../../../../lib/rate-limit";

const CLINICAL_PROMPT = (
  chiefComplaint: string,
  age: number | undefined,
  sex: string | undefined,
  vitalsText: string,
  withFollowUp: boolean
) =>
  `You are a clinical decision support AI for hospitals in Uganda and East Africa.

Patient: ${age ?? "?"} year old ${sex ?? "unknown"}
Chief Complaint: "${chiefComplaint}"
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
  "ucg_reference": "string or null"${withFollowUp ? ',\n  "follow_up_questions": ["targeted question that would most reduce diagnostic uncertainty"]' : ''}
}

${withFollowUp ? 'Include exactly 3 follow_up_questions that would most sharpen the differential (travel, sick contacts, pregnancy, meds, etc.). ' : ''}Prioritise East African endemic diseases. Prefer tests available at district hospital level. Max 5 differentials.`;

async function tryGemini(prompt: string): Promise<{ data: Record<string, unknown>; provider: string; model: string } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const genAI = new GoogleGenAI({ apiKey: key });
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    const text = (result.text ?? "")
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const data = JSON.parse(text);
    return { data, provider: "gemini", model: "gemini-2.0-flash" };
  } catch {
    return null;
  }
}

async function tryOpenRouter(prompt: string): Promise<{ data: Record<string, unknown>; provider: string; model: string } | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://synapseos.tech",
        "X-Title": "Synapse OS Clinical AI",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1-distill-llama-70b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = (json.choices?.[0]?.message?.content ?? "")
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim();
    const data = JSON.parse(text);
    return { data, provider: "deepseek", model: "deepseek-r1-distill-llama-70b" };
  } catch {
    return null;
  }
}

async function tryDeepSeekDirect(prompt: string): Promise<{ data: Record<string, unknown>; provider: string; model: string } | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = (json.choices?.[0]?.message?.content ?? "")
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const data = JSON.parse(text);
    return { data, provider: "deepseek", model: "deepseek-chat" };
  } catch {
    return null;
  }
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

  const body = await req.json() as {
    chiefComplaint: string;
    age?: number;
    sex?: string;
    vitals?: Record<string, number>;
    requestFollowUp?: boolean;
  };
  const { chiefComplaint, age, sex, vitals, requestFollowUp } = body;

  if (!chiefComplaint) {
    return NextResponse.json({ error: "chiefComplaint is required" }, { status: 400 });
  }

  const vitalsText = vitals
    ? `Temp: ${vitals.temperature_c ?? "?"}°C, HR: ${vitals.heart_rate ?? "?"}, BP: ${vitals.bp_systolic ?? "?"}/${vitals.bp_diastolic ?? "?"}, SpO2: ${vitals.spo2 ?? "?"}%`
    : "not recorded";

  const prompt = CLINICAL_PROMPT(chiefComplaint, age, sex, vitalsText, Boolean(requestFollowUp));

  // Try AI providers in order: Gemini → OpenRouter (DeepSeek) → DeepSeek direct
  const result =
    (await tryGemini(prompt)) ??
    (await tryOpenRouter(prompt)) ??
    (await tryDeepSeekDirect(prompt));

  if (!result) {
    return NextResponse.json(
      { error: "All AI providers unavailable. Please try again later." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ...result.data,
    ai_provider: result.provider,
    ai_model: result.model,
  });
}
