import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { isContextError, gateHospitalModule } from '@/lib/hospital-shared'
import { requireHospitalStaffContext } from '@/lib/hospital-dept'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireHospitalStaffContext()
  if (isContextError(ctx)) return ctx
  const blocked = await gateHospitalModule(ctx.tenantId, ctx.hospitalId, 'lab')
  if (blocked) return blocked
  const { id } = await params
  const db = supabaseAdmin as any
  const { data, error } = await db
    .from('lab_reports')
    .select('id, tenant_id, facility_id, patient_id, encounter_id, lab_order_id, accession, status, version, report_type, generated_at, verified_by, released_at, supersedes_report_id, template_version, html_snapshot, content_hash')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .eq('facility_id', ctx.hospitalId)
    .in('status', ['FINAL', 'AMENDED'])
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Lab report not found' }, { status: 404 })
  if (new URL(request.url).searchParams.get('format') === 'html') {
    return new NextResponse(data.html_snapshot, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' },
    })
  }
  return NextResponse.json({
    report: {
      id: data.id,
      status: data.status,
      version: data.version,
      accession: data.accession,
      releasedAt: data.released_at,
      templateVersion: data.template_version,
      contentHash: data.content_hash,
      pdf: 'NOT_CONFIGURED',
    },
  })
}