import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { GoogleGenAI } from '@google/genai'
import { verifyToken, validateSession } from '@synapse/auth'
import { SESSION_COOKIE } from '@synapse/config/constants'
import { createServiceClient } from '../../../../lib/supabase/server'

interface IntakeMessage {
  role: 'user' | 'bot'
  content: string
}

const SYSTEM = `You are a compassionate medical triage AI for Synapse OS in Uganda/East Africa. Your job is to assess a patient's symptoms through conversational questions and determine triage urgency.

CONVERSATION FLOW (ask one question at a time):
1. Main symptom / chief complaint
2. Duration (how long?)
3. Severity (1-10 scale)
4. Associated symptoms
5. Relevant history (chronic conditions, medications)
6. Ask 1-2 clarifying questions based on symptoms
7. After collecting enough information (at least 5 exchanges), provide triage assessment

RESPONSE RULES:
- Ask only ONE question per message
- Be warm and clear, avoid medical jargon
- After enough information is gathered (when you have symptom, duration, severity, and associated symptoms), end with JSON triage in this exact format on a NEW line:

TRIAGE_RESULT:{"urgency":"low|medium|high|emergency","recommendation":"your recommendation","summary":"brief clinical summary","action":"book|emergency|home_care"}

DO NOT provide the TRIAGE_RESULT until you have asked at least 4 questions and have sufficient clinical information.
Common East African conditions to consider: malaria, typhoid, HIV, TB, hypertension, diabetes, respiratory infections.`

async function requireSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? null
  if (!token) return null
  const payload = await verifyToken(token).catch(() => null)
  if (!payload?.sub) return null
  const { valid } = await validateSession(token)
  if (!valid) return null
  return payload.sub as string
}

export async function POST(req: NextRequest) {
  try {
    const sessionUserId = await requireSessionUserId()
    const body = (await req.json()) as {
      messages: IntakeMessage[]
      userId?: string
      caseId?: string
    }
    const { messages, caseId } = body

    // Persist only for authenticated users; never trust body userId.
    const userId = sessionUserId

    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const conversation = messages
      .map((m) => `${m.role === 'user' ? 'Patient' : 'Triage AI'}: ${m.content}`)
      .join('\n')

    const prompt = `${SYSTEM}\n\nConversation:\n${conversation}\n\nTriage AI:`

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })

    const text = (result.text ?? '').trim()

    let reply = text
    let triage = null
    let done = false
    let activeCaseId = caseId

    if (text.includes('TRIAGE_RESULT:')) {
      const parts = text.split('TRIAGE_RESULT:')
      reply = (parts[0] ?? '').trim()
      try {
        triage = JSON.parse((parts[1] ?? '').trim().split('\n')[0]!)
        done = true
      } catch {
        /* malformed triage, continue */
      }
    }

    if (userId) {
      const supabase = createServiceClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any

      if (!activeCaseId) {
        const userMessages = messages.filter((m) => m.role === 'user')
        const { data: newCase } = (await sb
          .from('telemedicine_intake_cases')
          .insert({
            user_id: userId,
            patient_id: userId,
            status: 'in_progress',
            symptoms: userMessages[0]?.content ?? null,
          })
          .select('id')
          .single()) as { data: { id: string } | null }
        activeCaseId = newCase?.id ?? undefined
      }

      if (activeCaseId) {
        const lastUserMsg = messages[messages.length - 1]
        await sb.from('telemedicine_intake_messages').insert([
          { case_id: activeCaseId, role: 'patient', content: lastUserMsg?.content ?? '' },
          { case_id: activeCaseId, role: 'ai', content: reply },
        ])

        if (done && triage) {
          await sb
            .from('telemedicine_intake_cases')
            .update({
              status: 'triaged',
              urgency: triage.urgency,
              triage_summary: triage,
              recommendation: { text: triage.recommendation, action: triage.action },
            })
            .eq('id', activeCaseId)
        }
      }
    }

    return NextResponse.json({ reply, triage, done, caseId: activeCaseId })
  } catch (err) {
    console.error('[tele/intake]', err)
    return NextResponse.json({ error: 'Intake service error' }, { status: 500 })
  }
}
