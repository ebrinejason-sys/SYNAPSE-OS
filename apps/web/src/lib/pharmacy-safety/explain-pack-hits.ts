import { GoogleGenAI } from '@google/genai'
import type { MatchedInteraction } from './interaction-pack'

/**
 * Narrate pack hits for counselling — NEVER invent new interactions or clearance.
 * Returns null when Gemini is unavailable (caller should fail closed on explainer only).
 */
export async function explainPackHits(hits: MatchedInteraction[]): Promise<string | null> {
  if (hits.length === 0) return null
  if (!process.env.GEMINI_API_KEY) return null

  const payload = hits.map((h) => ({
    drugs: h.drugs,
    severity: h.severity,
    description: h.description,
    recommendation: h.recommendation,
    knowledgeVersion: h.knowledgeVersion,
  }))

  const prompt = `You are a pharmacy counselling assistant for East Africa.
You MUST ONLY rephrase the provided curated interaction hits for a pharmacist to say to a patient/colleague.
Rules:
- Do NOT add new drug pairs or severities not in the input
- Do NOT say the combination is safe or cleared
- Do NOT invent doses
- Keep under 120 words
- Plain language, practical counselling tone
- End with: "This is an explanation of curated pack hits — pharmacist verification still required."

Hits JSON:
${JSON.stringify(payload)}`

  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })
    const text = (result.text ?? '').trim()
    if (!text) return null
    return text
  } catch (err) {
    console.error('[pharmacy/explain-pack]', err)
    return null
  }
}
