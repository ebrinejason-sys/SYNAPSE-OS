import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendHospitalStaffInviteEmail } from '../../../../../../lib/resend'
import {
  isContextError,
  logHospitalAudit,
  requireHospitalAdminContext,
  requireHospitalCapability,
  staffInviteSchema,
} from '../../../../../../lib/hospital-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalAdminContext({ allowLaboratory: true })
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'staff', 'write')
  if (cap) return cap

  const body = await req.json().catch(() => null)
  const parsed = staffInviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  if (ctx.facilityType === 'laboratory' && !['lab_admin', 'lab_scientist', 'lab_technician', 'receptionist', 'billing_officer'].includes(parsed.data.role)) {
    return NextResponse.json({ error: 'Role unavailable for a standalone laboratory.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  if (parsed.data.department_id) {
    const { data: department } = await db.from('departments').select('id').eq('id', parsed.data.department_id).eq('tenant_id', ctx.tenantId).maybeSingle()
    if (!department) return NextResponse.json({ error: 'Department unavailable for this facility.' }, { status: 403 })
  }

  const { data: dup } = await db
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (dup) {
    return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
  }

  const profileId = randomUUID()
  const [firstName, ...rest] = parsed.data.full_name.trim().split(/\s+/)

  const profileRow = {
    id: profileId,
    email,
    full_name: parsed.data.full_name.trim(),
    first_name: firstName,
    last_name: rest.join(' ') || null,
    phone: parsed.data.phone ?? null,
    role: parsed.data.role,
    tenant_id: ctx.tenantId,
    hospital_id: ctx.hospitalId,
    department_id: parsed.data.department_id ?? null,
    must_change_password: true,
    onboarding_complete: false,
    verification_status: 'verified',
    created_by: ctx.userId,
  }

  const { data: profile, error } = await db.from('profiles').insert(profileRow).select('id,email,full_name,role').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: hospital } = await db
    .from('hospitals')
    .select('name')
    .eq('id', ctx.hospitalId)
    .maybeSingle()

  const hospitalName = hospital?.name ?? 'your hospital'

  const inviteToken = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '')
  const { error: inviteError } = await db.from('facility_invitations').insert({
    tenant_id: ctx.tenantId, email, full_name: parsed.data.full_name.trim(),
    role: parsed.data.role, profile_id: profileId, invite_token: inviteToken,
    status: 'PENDING', expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), created_by: ctx.userId,
  })
  if (inviteError) return NextResponse.json({ error: 'Secure invitation could not be created.' }, { status: 500 })
  let inviteStatus = 'SENT'
  try {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://synapseos.tech').replace(/\/$/, '')
    await sendHospitalStaffInviteEmail({ to: email, hospitalName, staffName: parsed.data.full_name.trim(),
      role: parsed.data.role, inviteUrl: `${appUrl}/invite/facility/${inviteToken}` })
    await db.from('facility_invitations').update({ status: 'SENT', sent_at: new Date().toISOString() }).eq('invite_token', inviteToken)
  } catch {
    inviteStatus = 'PENDING'
  }

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'profiles',
    recordId: profile.id,
    newValue: { email, role: parsed.data.role, invited: true },
  })

  return NextResponse.json(
    { staff: { id: profile.id, email, full_name: profile.full_name, role: profile.role }, inviteStatus },
    { status: 201 },
  )
}
