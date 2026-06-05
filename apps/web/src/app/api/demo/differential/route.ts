import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimiters } from "../../../../lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await checkRateLimit(rateLimiters.demoAi, ip);
  if (!success) {
    return NextResponse.json({ error: "Demo rate limit exceeded. Try again in an hour." }, { status: 429 });
  }

  const body = await req.json() as {
    chiefComplaint: string;
    age?: number;
    sex?: string;
    vitals?: Record<string, number>;
  };
  const { chiefComplaint, age, sex, vitals } = body;

  if (!chiefComplaint) {
    return NextResponse.json({ error: "chiefComplaint is required" }, { status: 400 });
  }

  const vitalsText = vitals
    ? `Temp: ${vitals.temperature_c ?? "?"}°C, HR: ${vitals.heart_rate ?? "?"}, BP: ${vitals.bp_systolic ?? "?"}/${vitals.bp_diastolic ?? "?"}, SpO2: ${vitals.spo2 ?? "?"}%`
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
  "ucg_reference": "string or null"
}

Prioritise East African endemic diseases. Prefer tests available at district hospital level. Max 5 differentials.`;

  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const result = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  const text = (result.text ?? "")
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON", raw: text }, { status: 502 });
  }
}
