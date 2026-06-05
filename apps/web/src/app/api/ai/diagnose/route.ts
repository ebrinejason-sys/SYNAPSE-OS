import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimiters } from "../../../../lib/rate-limit";
import { createServiceClient } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await checkRateLimit(rateLimiters.ai, ip);
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json() as {
    chiefComplaint: string;
    vitals?: {
      temperature_c?: number;
      heart_rate?: number;
      bp_systolic?: number;
      bp_diastolic?: number;
      spo2?: number;
      respiratory_rate?: number;
    };
    age?: number;
    sex?: string;
    encounterId?: string;
    tenantId?: string;
  };
  const { chiefComplaint, vitals, age, sex, encounterId, tenantId } = body;

  if (!chiefComplaint) {
    return NextResponse.json({ error: "chiefComplaint is required" }, { status: 400 });
  }

  const vitalsText = vitals
    ? `Temp: ${vitals.temperature_c ?? "?"}°C, HR: ${vitals.heart_rate ?? "?"}, BP: ${vitals.bp_systolic ?? "?"}/${vitals.bp_diastolic ?? "?"}, SpO2: ${vitals.spo2 ?? "?"}%, RR: ${vitals.respiratory_rate ?? "?"}`
    : "not recorded";

  const prompt = `You are a clinical decision support AI for hospitals in Uganda and East Africa.

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
  "ucg_reference": "Uganda Clinical Guidelines reference if applicable or null"
}

Rules:
- Max 5 differentials, ranked by probability
- Prioritise East African endemic diseases: malaria, typhoid, TB, HIV, brucellosis, sickle cell, viral haemorrhagic fevers, schistosomiasis
- Consider resource-limited setting: prefer tests available at district hospital level
- Apply Uganda Clinical Guidelines (UCG) where applicable`;

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  const text = (result.text ?? "")
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON", raw: text }, { status: 502 });
  }

  if (encounterId && tenantId) {
    const supabase = createServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("encounters") as any)
      .update({
        metadata: { ai_differential: parsed, ai_generated_at: new Date().toISOString() },
      })
      .eq("id", encounterId)
      .eq("tenant_id", tenantId);
  }

  return NextResponse.json(parsed);
}
