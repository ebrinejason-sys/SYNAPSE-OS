import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(req: NextRequest) {
  try {
    const { imageB64, imageMime, foodName } = await req.json() as {
      imageB64?: string
      imageMime?: string
      foodName?: string
    }

    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    let prompt: string
    const parts: unknown[] = []

    if (imageB64) {
      parts.push({
        inlineData: { mimeType: imageMime || 'image/jpeg', data: imageB64 },
      })
      prompt = `Analyse this food image. Identify the food, estimate calories, and give a brief nutritional note relevant to East African health context (mention if it's a good source of protein, carbs, vitamins, etc., and any tips). Answer ONLY with JSON (no markdown): {"food_name": "string", "calories": number, "portion": "string", "note": "1-2 sentence nutritional note"}`
    } else if (foodName) {
      prompt = `The patient ate: "${foodName}". This is Uganda/East Africa. Estimate calories and give a brief nutritional note. Answer ONLY with JSON (no markdown): {"food_name": "${foodName}", "calories": number, "note": "1-2 sentence nutritional note"}`
    } else {
      return NextResponse.json({ error: 'imageB64 or foodName required' }, { status: 400 })
    }

    const contents = imageB64
      ? [{ role: 'user', parts: [...parts as object[], { text: prompt }] }]
      : prompt

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
    })

    const raw = (result.text ?? '').replace(/```json\n?|```\n?/g, '').trim()
    let parsed: { calories?: number; note?: string; food_name?: string }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ calories: null, note: null })
    }

    return NextResponse.json({ calories: parsed.calories ?? null, note: parsed.note ?? null, food_name: parsed.food_name ?? null })
  } catch (err) {
    console.error('[diet-analyze]', err)
    return NextResponse.json({ calories: null, note: null }, { status: 500 })
  }
}
