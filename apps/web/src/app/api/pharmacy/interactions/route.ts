import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import {
  KNOWLEDGE_SOURCE,
  KNOWLEDGE_VERSION,
  matchPackInteractions,
  type MatchedInteraction,
  type PackSeverity,
} from '@/lib/pharmacy-safety/interaction-pack'
import { explainPackHits } from '@/lib/pharmacy-safety/explain-pack-hits'

type Interaction = {
  severity: PackSeverity
  drugs: string[]
  description: string
  recommendation: string
  source?: string
  knowledgeVersion?: string
}

/**
 * Medication safety check — fail closed.
 * - Deterministic pack hits are authoritative for those pairs.
 * - Generative AI is advisory only and NEVER returns safe=true by itself.
 * - Missing AI / errors → available=false (never invent “safe”).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await checkRateLimit(rateLimiters.ai, ip)
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const body = (await req.json().catch(() => ({}))) as { drugs?: unknown }
  const drugs = Array.isArray(body.drugs)
    ? body.drugs
        .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
        .map((d) => d.trim())
    : []

  if (drugs.length < 2) {
    return NextResponse.json({ error: 'At least 2 drug names are required' }, { status: 400 })
  }

  const packHits = matchPackInteractions(drugs)
  const packInteractions: Interaction[] = packHits.map((h: MatchedInteraction) => ({
    severity: h.severity,
    drugs: h.drugs,
    description: h.description,
    recommendation: h.recommendation,
    source: h.source,
    knowledgeVersion: h.knowledgeVersion,
  }))

  const hasMajor = packInteractions.some((i) => i.severity === 'major')
  const hasAnyPack = packInteractions.length > 0

  // Deterministic hits alone are enough for a clear “not clear to dispense” signal.
  if (hasAnyPack) {
    const explanation = await explainPackHits(packHits)
    return NextResponse.json({
      available: true,
      status: 'interactions_found',
      safe: false,
      verdict: 'deterministic_hits',
      requiresPharmacistReview: true,
      knowledgeVersion: KNOWLEDGE_VERSION,
      knowledgeSource: KNOWLEDGE_SOURCE,
      interactions: packInteractions,
      advisory: [] as Interaction[],
      explanation: explanation ?? null,
      summary: hasMajor
        ? `Deterministic pack (${KNOWLEDGE_VERSION}) found major interaction(s). Do not dispense without pharmacist review.`
        : `Deterministic pack (${KNOWLEDGE_VERSION}) found interaction(s). Pharmacist review required.`,
    })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      available: false,
      status: 'unavailable',
      safe: false,
      verdict: 'unavailable',
      requiresPharmacistReview: true,
      knowledgeVersion: KNOWLEDGE_VERSION,
      knowledgeSource: KNOWLEDGE_SOURCE,
      interactions: [] as Interaction[],
      advisory: [] as Interaction[],
      summary:
        'No curated pack match for these names, and generative checking is not configured. Treat as unknown — verify manually before dispensing.',
    })
  }

  const prompt = `You are an advisory clinical pharmacist assistant for East Africa.
This output is NOT a safety clearance. Never claim the combination is safe to dispense without a human pharmacist.

Check possible drug-drug interactions for: ${drugs.join(', ')}

Return ONLY valid JSON (no markdown):
{
  "interactions": [
    {
      "severity": "major|moderate|minor",
      "drugs": ["drug A", "drug B"],
      "description": "brief mechanism or risk",
      "recommendation": "clinical action"
    }
  ],
  "summary": "one sentence — emphasize pharmacist verification"
}

Rules:
- List clinically significant interactions only
- Use generic drug names
- If unsure, return empty interactions and say verification is still required
- Do not include a "safe" field`

  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })

    const text = (result.text ?? '')
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(text) as {
      interactions?: Interaction[]
      summary?: string
    }

    const advisory = (parsed.interactions ?? []).map((i) => ({
      ...i,
      source: 'Generative advisory (not a validated knowledge base)',
      knowledgeVersion: 'gemini-advisory',
    }))

    return NextResponse.json({
      available: true,
      status: 'advisory_only',
      safe: false,
      verdict: 'advisory_only',
      requiresPharmacistReview: true,
      knowledgeVersion: KNOWLEDGE_VERSION,
      knowledgeSource: KNOWLEDGE_SOURCE,
      interactions: [] as Interaction[],
      advisory,
      summary:
        parsed.summary ??
        'AI advisory only — curated pack had no match. Pharmacist must verify before dispensing; this is not a safety clearance.',
    })
  } catch (error) {
    console.error('[pharmacy/interactions]', error)
    return NextResponse.json({
      available: false,
      status: 'unavailable',
      safe: false,
      verdict: 'unavailable',
      requiresPharmacistReview: true,
      knowledgeVersion: KNOWLEDGE_VERSION,
      knowledgeSource: KNOWLEDGE_SOURCE,
      interactions: [] as Interaction[],
      advisory: [] as Interaction[],
      summary:
        'Interaction service error. Treat as unknown — verify manually before dispensing.',
    })
  }
}
