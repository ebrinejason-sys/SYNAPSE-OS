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
              text: `Look at this image carefully. Does it contain a medical credential document such as a medical licence, registration certificate, professional qualification certificate, or similar healthcare credential?

Answer ONLY with valid JSON (no markdown):
{"valid": true/false, "type": "document type or null", "confidence": "high/medium/low", "reason": "brief explanation"}`,
            },
          ],
        },
      ],
    })

    const raw = (result.text ?? '').replace(/```json\n?|```\n?/g, '').trim()
    let parsed: { valid: boolean; type?: string; confidence?: string; reason?: string }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ valid: false, reason: 'AI returned invalid response', raw })
    }

    return NextResponse.json({ ...parsed, valid: parsed.valid === true })
  } catch (err) {
    console.error('[document-check]', err)
    return NextResponse.json({ valid: false, reason: 'Verification service error' }, { status: 500 })
  }
}
