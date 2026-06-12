import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, validateSession } from '@synapse/auth'
import { supabaseAdmin } from '@synapse/db/admin'
import { SESSION_COOKIE } from '@synapse/config/constants'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? null

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await verifyToken(token).catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { valid } = await validateSession(token)
  if (!valid) return NextResponse.json({ error: 'Session expired' }, { status: 401 })

  if (!payload.tenant_id) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    patientId?: string
    chiefComplaint: string
    clinicalStage?: string | null
    metadata?: Record<string, unknown>
    vitals?: {
      temperature_c?: number
      heart_rate?: number
      bp_systolic?: number
      bp_diastolic?: number
      spo2?: number
    }
  }

  if (!body.chiefComplaint?.trim()) {
    return NextResponse.json({ error: 'Chief complaint is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const { data: encounter, error: encErr } = await db
    .from('encounters')
    .insert({
      patient_id: body.patientId || null,
      tenant_id: payload.tenant_id,
      clinician_id: payload.sub,
      chief_complaint: body.chiefComplaint.trim(),
      clinical_stage: body.clinicalStage ?? null,
      status: 'open',
      metadata: body.metadata ?? null,
    })
    .select('id')
    .single()

  if (encErr || !encounter) {
    return NextResponse.json({ error: 'Failed to create encounter' }, { status: 500 })
  }

  const v = body.vitals
  if (v && Object.values(v).some(x => x !== undefined)) {
    await db.from('vitals').insert({
      encounter_id: encounter.id,
      tenant_id: payload.tenant_id,
      recorded_by: payload.sub,
      bp_systolic: v.bp_systolic ?? null,
      bp_diastolic: v.bp_diastolic ?? null,
      heart_rate: v.heart_rate ?? null,
      temperature_c: v.temperature_c ?? null,
      spo2: v.spo2 ?? null,
      recorded_at: new Date().toISOString(),
      version: 1,
    })
  }

  return NextResponse.json({ ok: true, encounterId: encounter.id })
}
