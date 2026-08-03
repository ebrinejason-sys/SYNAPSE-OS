import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { GoogleGenAI } from '@google/genai'
import { verifyToken, validateSession } from '@synapse/auth'
import { SESSION_COOKIE } from '@synapse/config/constants'
import { createServiceClient } from '../../../../lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value ?? null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token).catch(() => null)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { valid } = await validateSession(token)
    if (!valid) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    // Never trust caller-supplied userId — session subject only.
    const userId = payload.sub as string
    const { message } = (await req.json()) as { message?: string }
    if (!message?.trim()) {
      return NextResponse.json({ error: 'message required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: history } = await (supabase as any)
      .from('ai_health_chats')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10) as { data: { role: string; content: string }[] | null }

    const recentHistory = (history ?? []).reverse()

    const systemPrompt = `You are a compassionate, knowledgeable AI Health Coach for Synapse OS — an AI-powered health platform for patients in Uganda and East Africa.

Your role:
- Provide evidence-based health guidance personalised to the East African context
- Help patients understand their health records, lab results, and medications
- Encourage healthy lifestyle habits appropriate for Uganda (diet, exercise, sleep)
- Remind users when to seek professional medical care
- Be warm, clear, and avoid medical jargon unless explaining it

Always remind users that your advice does not replace a qualified doctor. For serious symptoms, urge them to visit a healthcare facility immediately.

East African context: Common health challenges include malaria, typhoid, HIV, TB, hypertension, diabetes, and malnutrition. Consider local foods like matooke, posho, groundnuts, fish, and sukuma wiki when giving nutrition advice.`

    const conversationParts = recentHistory
      .map((m) => `${m.role === 'user' ? 'Patient' : 'Health Coach'}: ${m.content}`)
      .join('\n')

    const fullPrompt = conversationParts
      ? `${systemPrompt}\n\nConversation so far:\n${conversationParts}\n\nPatient: ${message}\nHealth Coach:`
      : `${systemPrompt}\n\nPatient: ${message}\nHealth Coach:`

    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: fullPrompt,
    })

    const reply = result.text?.trim() ?? 'I had trouble generating a response. Please try again.'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('ai_health_chats').insert([
      { user_id: userId, role: 'user', content: message },
      { user_id: userId, role: 'assistant', content: reply },
    ])

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[health/coach]', err)
    return NextResponse.json({ error: 'Coach service error' }, { status: 500 })
  }
}
