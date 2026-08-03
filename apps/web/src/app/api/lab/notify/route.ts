import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { notifyPatientLabResult } from '@synapse/auth/mobile-push'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

/**
 * Notify a patient that a lab result is ready.
 * Body: { patientId?: string, userId?: string, testName?: string, resultId?: string }
 * Resolves patient → profile via patients.created_by when userId is omitted.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as {
    patientId?: string
    userId?: string
    testName?: string
    resultId?: string
  } | null

  let userId = body?.userId?.trim() || null

  if (!userId && body?.patientId) {
    const { data: patient } = await db()
      .from('patients')
      .select('created_by')
      .eq('id', body.patientId)
      .maybeSingle()
    userId = (patient?.created_by as string | null) ?? null
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'userId or patientId with linked profile required' },
      { status: 400 },
    )
  }

  notifyPatientLabResult({
    userId,
    testName: body?.testName ?? null,
  })

  return NextResponse.json({
    success: true,
    notifiedUserId: userId,
    resultId: body?.resultId ?? null,
  })
}
