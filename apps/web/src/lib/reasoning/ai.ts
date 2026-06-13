// apps/web/src/lib/reasoning/ai.ts
// AI integration for differential diagnosis proposals.
// DECISION SUPPORT ONLY — outputs are suggestions that require clinician confirmation.

import { GoogleGenAI } from '@google/genai'
import type { AIProposalResponse, ReasoningEvidence } from './types'

function getGenAI(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not configured')
  return new GoogleGenAI({ apiKey: key })
}

function evidenceSummary(evidence: ReasoningEvidence[]): string {
  if (!evidence.length) return 'No additional findings recorded.'
  return evidence
    .map(e => `${e.present ? '+' : '-'} [${e.source}] ${e.description}${e.value ? ` (${e.value})` : ''}`)
    .join('\n')
}

export async function generateDifferential(params: {
  chiefComplaint: string
  evidence:       ReasoningEvidence[]
  age?:           number
  sex?:           string
  vitals?: {
    temperature_c?: number
    heart_rate?: number
    bp_systolic?: number
    bp_diastolic?: number
    spo2?: number
  }
}): Promise<AIProposalResponse> {
  const vitalsText = params.vitals
    ? `Temp: ${params.vitals.temperature_c ?? '?'}°C | HR: ${params.vitals.heart_rate ?? '?'} | ` +
      `BP: ${params.vitals.bp_systolic ?? '?'}/${params.vitals.bp_diastolic ?? '?'} | ` +
      `SpO2: ${params.vitals.spo2 ?? '?'}%`
    : 'Not recorded'

  const prompt = `You are a clinical decision support AI for hospitals in Uganda and East Africa.
ROLE: You SUGGEST differentials. A licensed clinician MUST confirm before any diagnosis is recorded.

Patient: ${params.age ?? '?'} year old ${params.sex ?? 'unknown sex'}
Chief Complaint: "${params.chiefComplaint}"
Vitals: ${vitalsText}
Clinical Findings:
${evidenceSummary(params.evidence)}

Return ONLY valid JSON. No markdown. No preamble.
{
  "hypotheses": [
    {
      "conditionName": "string",
      "icd11Code": "string or null",
      "icd11Uri": "string or null",
      "priorProbability": 0.0-1.0,
      "harmIfMissed": 0.0-1.0,
      "cantMiss": true/false,
      "aiReasoning": "one-sentence clinical rationale",
      "confidence": 0.0-1.0,
      "evidenceImpacts": [
        { "evidenceDescription": "finding name", "likelihoodRatio": number }
      ]
    }
  ],
  "suggestedWorkup": ["test name"],
  "redFlags": ["flag"],
  "clinicalNote": "one-sentence summary",
  "ucgReference": "Uganda Clinical Guidelines reference or null"
}

Rules:
- Max 5 hypotheses, most likely first (but rank by expectedHarm = probability × harmIfMissed)
- harmIfMissed: 0=trivial, 1=fatal if missed; set high for life-threatening conditions
- cantMiss: true for any condition where missing it could cause death or permanent harm
- likelihoodRatio: how much each finding shifts probability (LR>1 increases, LR<1 decreases)
- Prioritise East African endemic diseases: malaria, typhoid, TB, HIV, brucellosis, sickle cell, VHF, schistosomiasis
- Consider resource-limited district-hospital setting
- Apply Uganda Clinical Guidelines (UCG) where applicable
- priorProbability should reflect endemic prevalence in Uganda`

  const genAI = getGenAI()
  const result = await genAI.models.generateContent({
    model:    'gemini-2.0-flash',
    contents: prompt,
  })

  const text = (result.text ?? '')
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  let parsed: AIProposalResponse
  try {
    parsed = JSON.parse(text) as AIProposalResponse
  } catch {
    throw new Error(`AI returned invalid JSON: ${text.slice(0, 200)}`)
  }

  // Validate + clamp
  parsed.hypotheses = (parsed.hypotheses ?? []).slice(0, 5).map(h => ({
    ...h,
    priorProbability: Math.max(0.001, Math.min(0.999, Number(h.priorProbability) || 0.05)),
    harmIfMissed:     Math.max(0,     Math.min(1,     Number(h.harmIfMissed)     || 0.5)),
    confidence:       Math.max(0,     Math.min(1,     Number(h.confidence)       || 0.5)),
    cantMiss:         Boolean(h.cantMiss),
    icd11Code:        h.icd11Code ?? null,
    icd11Uri:         h.icd11Uri ?? null,
    evidenceImpacts:  (h.evidenceImpacts ?? []).map(ei => ({
      evidenceDescription: ei.evidenceDescription,
      likelihoodRatio:     Math.max(0.01, Number(ei.likelihoodRatio) || 1),
    })),
  }))

  return parsed
}
