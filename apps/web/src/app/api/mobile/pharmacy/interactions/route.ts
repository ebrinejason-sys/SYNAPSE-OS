import { NextRequest, NextResponse } from 'next/server'
import {
  isMobileAuth,
  requireMobilePharmacyAuth,
} from '../../../../../lib/mobile-pharmacy-auth'
import {
  KNOWLEDGE_SOURCE,
  KNOWLEDGE_VERSION,
  matchPackInteractions,
} from '../../../../../lib/pharmacy-safety/interaction-pack'

export const dynamic = 'force-dynamic'

/** Mobile deterministic interaction check (pack only — no generative “safe”). */
export async function POST(req: NextRequest) {
  const auth = await requireMobilePharmacyAuth(req)
  if (!isMobileAuth(auth)) return auth

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
    return NextResponse.json({
      available: false,
      status: 'unavailable',
      safe: false,
      verdict: 'unavailable',
      requiresPharmacistReview: true,
      knowledgeVersion: KNOWLEDGE_VERSION,
      knowledgeSource: KNOWLEDGE_SOURCE,
      interactions: [],
      summary:
        'No curated pack match. This is not a clearance — verify with references before dispensing.',
    })
  }

  const hasMajor = hits.some((h) => h.severity === 'major')
  return NextResponse.json({
    available: true,
    status: 'interactions_found',
    safe: false,
    verdict: 'deterministic_hits',
    requiresPharmacistReview: true,
    knowledgeVersion: KNOWLEDGE_VERSION,
    knowledgeSource: KNOWLEDGE_SOURCE,
    interactions: hits.map((h) => ({
      severity: h.severity,
      drugs: h.drugs,
      description: h.description,
      recommendation: h.recommendation,
      source: h.source,
      knowledgeVersion: h.knowledgeVersion,
    })),
    summary: hasMajor
      ? `Major interaction(s) in pack ${KNOWLEDGE_VERSION}. Pharmacist review required.`
      : `Interaction(s) in pack ${KNOWLEDGE_VERSION}. Pharmacist review required.`,
  })
}
