import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'

type Interaction = {
  severity: 'major' | 'moderate' | 'minor'
  drugs: string[]
  description: string
  recommendation: string
}

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

  const body = await req.json().catch(() => ({})) as { drugs?: unknown }
  const drugs = Array.isArray(body.drugs)
    ? body.drugs.filter((d): d is string => typeof d === 'string' && d.trim().length > 0).map((d) => d.trim())
    : []

  if (drugs.length < 2) {
    return NextResponse.json({ error: 'At least 2 drug names are required' }, { status: 400 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      interactions: [] as Interaction[],
      safe: true,
      summary: 'Drug interaction checking is not configured. Contact your administrator.',
    })
  }

  const prompt = `You are a clinical pharmacist AI for East Africa.

Check drug-drug interactions for: ${drugs.join(', ')}

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
  "safe": true|false,
  "summary": "one sentence overall assessment"
}

Rules:
- List clinically significant interactions only
- Use generic drug names
- If no significant interactions, return empty interactions array and safe: true`

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
      safe?: boolean
      summary?: string
    }

    return NextResponse.json({
      interactions: parsed.interactions ?? [],
      safe: parsed.safe ?? (parsed.interactions?.length ?? 0) === 0,
      summary: parsed.summary ?? 'Interaction check complete.',
    })
  } catch (error) {
    console.error('[pharmacy/interactions]', error)
    return NextResponse.json({
      interactions: [] as Interaction[],
      safe: true,
      summary: 'Unable to check interactions right now. Verify manually before dispensing.',
    })
  }
}
