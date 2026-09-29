import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { encounterDiagnosisRow } from '@synapse/db/encounter-diagnosis'
import { lookupStem } from '@synapse/interop'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

const COLUMNS = 'id, encounter_id, tenant_id, stem_code, cluster_code, title, certainty, diagnosis_type, foundation_uri, linearization_uri, icd_release, selected_by, suggested_by, created_at'

/**
 * Clinician-selected ICD-11 on the existing encounter_diagnoses table.
 * Gated by opd.prescription.create, which doctor and clinical_officer already
 * hold and reception/nursing do not. Cache lookup only — no WHO call.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'prescription', 'read', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const { id: encounterId } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: loadError } = await db
    .from('encounters')
    .select('id')
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .eq('hospital_id', ctx.hospitalId)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })

  const { data, error } = await db
    .from('encounter_diagnoses')
    .select(COLUMNS)
    .eq('encounter_id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ diagnoses: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'prescription', 'create', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const { id: encounterId } = await params
  const body = await req.json().catch(() => null)
  const stem = String(body?.stem_code ?? body?.stemCode ?? '').trim()
  const entity = lookupStem(stem)
  if (!entity) {
    return NextResponse.json({ error: 'Unknown ICD-11 code', stem_code: stem }, { status: 422 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: loadError } = await db
    .from('encounters')
    .select('id, patient_id, is_signed')
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .eq('hospital_id', ctx.hospitalId)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  if (encounter.is_signed) {
    return NextResponse.json({ error: 'Encounter is signed' }, { status: 409 })
  }

  const { data: existing, error: existingError } = await db
    .from('encounter_diagnoses')
    .select(COLUMNS)
    .eq('encounter_id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .eq('stem_code', entity.stemCode)
    .eq('is_deleted', false)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (existing) return NextResponse.json({ diagnosis: existing, idempotent: true })

  const row = encounterDiagnosisRow({
    encounterId,
    tenantId: ctx.tenantId,
    selectedBy: ctx.userId,
    stemCode: entity.stemCode,
    title: entity.title,
    foundationUri: entity.foundationUri,
    linearizationUri: entity.linearizationUri,
    release: entity.release,
  })
  const { data: inserted, error: insertError } = await db
    .from('encounter_diagnoses')
    .insert(row)
    .select(COLUMNS)
    .single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'encounter_diagnoses',
    recordId: inserted.id,
    newValue: { stem_code: entity.stemCode, title: entity.title, patient_id: encounter.patient_id },
  })

  return NextResponse.json({ diagnosis: inserted, idempotent: false }, { status: 201 })
}
