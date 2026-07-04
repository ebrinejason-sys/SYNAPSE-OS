import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

function parseMedications(value: unknown): Array<{
  name?: string
  dose?: string
  frequency?: string
  notes?: string
}> {
  if (!value) return []
  if (Array.isArray(value)) {
    return value as Array<{ name?: string; dose?: string; frequency?: string; notes?: string }>
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value as Record<string, unknown>).filter(
      (v) => typeof v === 'object' && v !== null
    ) as Array<{ name?: string; dose?: string; frequency?: string; notes?: string }>
  }
  return []
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const userId = payload.sub as string
  const { id } = await params

  const match = /^profile-(\d+)$/.exec(id)
  if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const index = Number(match[1])

  const { data: profile } = await db()
    .from('patient_profiles')
    .select('current_medications')
    .eq('id', userId)
    .maybeSingle()

  const meds = parseMedications(profile?.current_medications)
  const med = meds[index]
  if (!med) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    medication: {
      id,
      name: med.name ?? 'Unknown medication',
      dose: med.dose ?? null,
      frequency: med.frequency ?? null,
      notes: med.notes ?? null,
      source: 'Health profile',
      prescribingProvider: null,
      prescribingEncounterId: null,
      startDate: null,
      endDate: null,
      refillsRemaining: null,
      indication: null,
    },
  })
}
