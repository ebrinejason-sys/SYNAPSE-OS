import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

function parseJsonArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? v : String(v)))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value as Record<string, unknown>).map(String)
  }
  return []
}

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

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  const userId = payload.sub as string

  const { data: profile } = await db()
    .from('patient_profiles')
    .select('current_medications')
    .eq('id', userId)
    .maybeSingle()

  const meds = parseMedications(profile?.current_medications)
  const medications = meds.map((m, i) => ({
    id: `profile-${i}`,
    name: m.name ?? 'Unknown medication',
    dose: m.dose ?? null,
    frequency: m.frequency ?? null,
    notes: m.notes ?? null,
    source: 'Health profile',
  }))

  return NextResponse.json({ medications })
}
