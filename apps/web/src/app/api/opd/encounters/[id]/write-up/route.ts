import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@synapse/db/admin'
import {
  composeClinicalNote,
  mergeWriteupIntoMetadata,
  normalizeClinicalWriteup,
  writeupCompleteness,
  writeupFromEncounterMetadata,
} from '@synapse/db/clinical-writeup'
import { isContextError, requireHospitalCapability, gateHospitalModule, logHospitalAudit, hospitalOutboxWrapMaterial } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

const writeupBodySchema = z.object({
  hpi: z.string().max(8000).optional(),
  pmh: z.string().max(8000).optional(),
  medications: z.string().max(8000).optional(),
  allergies: z.string().max(8000).optional(),
  familySocial: z.string().max(8000).optional(),
  ros: z.string().max(8000).optional(),
  examination: z.string().max(8000).optional(),
  assessment: z.string().max(8000).optional(),
  plan: z.string().max(8000).optional(),
  syncClinicalNote: z.boolean().optional().default(true),
})

type EncounterMeta = {
  clinical_note?: string
  writeup?: unknown
} & Record<string, unknown>

async function loadEncounter(db: any, tenantId: string, encounterId: string) {
  const { data, error } = await db
    .from('encounters')
    .select('id, patient_id, is_signed, chief_complaint, metadata, status')
    .eq('id', encounterId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return { data, error }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  // Authoring surface — same gate as creating an encounter.
  const cap = await requireHospitalCapability(ctx, 'encounter', 'create', 'opd')
  if (cap) return cap

  const { id: encounterId } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error } = await loadEncounter(db, ctx.tenantId, encounterId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })

  const writeup = writeupFromEncounterMetadata(encounter.metadata)
  const meta = (encounter.metadata ?? {}) as EncounterMeta
  return NextResponse.json({
    encounterId,
    patientId: encounter.patient_id,
    isSigned: Boolean(encounter.is_signed),
    status: encounter.status ?? null,
    chiefComplaint: encounter.chief_complaint,
    clinicalNote: meta.clinical_note ?? composeClinicalNote(writeup, encounter.chief_complaint),
    writeup,
    completeness: writeupCompleteness(writeup),
    // Auth identity for offline SyncCommand construction — never trust client-supplied tenant/actor on apply.
    syncContext: {
      tenantId: ctx.tenantId,
      facilityId: ctx.hospitalId,
      actorId: ctx.userId,
      outboxWrapMaterial: hospitalOutboxWrapMaterial(ctx.tenantId, ctx.userId),
    },
  }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'encounter', 'create', 'opd')
  if (cap) return cap

  const moduleBlock = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'opd')
  if (moduleBlock) return moduleBlock

  const { id: encounterId } = await params
  const body = await req.json().catch(() => null)
  const parsed = writeupBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any
  const { data: encounter, error: loadError } = await loadEncounter(db, ctx.tenantId, encounterId)
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  if (encounter.is_signed) {
    return NextResponse.json(
      { error: 'Encounter is signed — use amendment flow to change clinical content' },
      { status: 409 },
    )
  }

  const existing = writeupFromEncounterMetadata(encounter.metadata)
  const nextWriteup = normalizeClinicalWriteup({
    ...existing,
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: ctx.userId,
  })
  let metadata = mergeWriteupIntoMetadata(encounter.metadata, nextWriteup) as EncounterMeta
  const clinicalNote = parsed.data.syncClinicalNote
    ? composeClinicalNote(nextWriteup, encounter.chief_complaint)
    : (metadata.clinical_note ?? '')
  if (parsed.data.syncClinicalNote) {
    metadata = { ...metadata, clinical_note: clinicalNote }
  }

  const { error: updateError } = await db
    .from('encounters')
    .update({
      metadata,
      updated_at: new Date().toISOString(),
      status: encounter.status === 'open' || !encounter.status ? 'in_progress' : encounter.status,
    })
    .eq('id', encounterId)
    .eq('tenant_id', ctx.tenantId)
    .eq('is_signed', false)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await logHospitalAudit({
    ctx,
    action: 'UPDATE',
    tableName: 'encounters',
    recordId: encounterId,
    newValue: { writeup: nextWriteup },
  })

  return NextResponse.json({
    encounterId,
    writeup: nextWriteup,
    clinicalNote,
    completeness: writeupCompleteness(nextWriteup),
  })
}
