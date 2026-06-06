import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(req: NextRequest) {
  try {
    const { imageB64, mimeType } = await req.json() as { imageB64: string; mimeType: string }
    if (!imageB64) {
      return NextResponse.json({ valid: false, reason: 'No image provided' }, { status: 400 })
    }

    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageB64,
              },
            },
            {
              text: `Look at this image. Does it contain a clear, front-facing human face suitable for identity verification?

Requirements: face should be visible, well-lit, not obscured by sunglasses, masks, or heavy shadows.

Answer ONLY with valid JSON (no markdown):
{"valid": true/false, "faceCount": number, "quality": "good/fair/poor", "reason": "brief explanation"}`,
            },
          ],
        },
      ],
    })

    const raw = (result.text ?? '').replace(/```json\n?|```\n?/g, '').trim()
    let parsed: { valid: boolean; faceCount?: number; quality?: string; reason?: string }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ valid: false, reason: 'AI returned invalid response', raw })
    }

    const valid = parsed.valid === true && parsed.quality !== 'poor'
    return NextResponse.json({ ...parsed, valid })
  } catch (err) {
    console.error('[face-check]', err)
    return NextResponse.json({ valid: false, reason: 'Verification service error' }, { status: 500 })
  }
}
