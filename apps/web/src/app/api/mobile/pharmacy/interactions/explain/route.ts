import { NextRequest, NextResponse } from 'next/server'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../../lib/mobile-pharmacy-auth'
import { explainPackHits } from '../../../../../../lib/pharmacy-safety/explain-pack-hits'
import {
  KNOWLEDGE_VERSION,
  matchPackInteractions,
} from '../../../../../../lib/pharmacy-safety/interaction-pack'
import { checkRateLimit, rateLimiters } from '../../../../../../lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * AI narration of deterministic pack hits only.
 * Refuses when there are no pack hits — never generates a clearance story.
 */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

  const ip = req.headers.get('x-forwarded-for') ?? auth.userId
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

  const hits = matchPackInteractions(drugs)
  if (hits.length === 0) {
    return NextResponse.json(
      {
        error: 'No pack hits to explain',
        code: 'NO_PACK_HITS',
        safe: false,
        available: false,
        summary:
          'Explainer only narrates curated pack matches. No match found — verify manually; not cleared.',
      },
      { status: 409 },
    )
  }

  const explanation = await explainPackHits(hits)
  if (!explanation) {
    return NextResponse.json(
      {
        error: 'Explainer unavailable',
        code: 'EXPLAINER_UNAVAILABLE',
        safe: false,
        available: false,
        knowledgeVersion: KNOWLEDGE_VERSION,
        interactions: hits,
        summary:
          'Pack hits exist, but AI narration is unavailable. Use the pack text; pharmacist review still required.',
      },
      { status: 503 },
    )
  }

  return NextResponse.json({
    available: true,
    safe: false,
    verdict: 'pack_explanation_only',
    requiresPharmacistReview: true,
    knowledgeVersion: KNOWLEDGE_VERSION,
    interactions: hits.map((h) => ({
      severity: h.severity,
      drugs: h.drugs,
      description: h.description,
      recommendation: h.recommendation,
      source: h.source,
      knowledgeVersion: h.knowledgeVersion,
    })),
    explanation,
    summary:
      'AI narration of curated pack hits only — not a safety clearance. Pharmacist verification required.',
  })
}
