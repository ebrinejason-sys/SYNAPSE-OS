import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { hashPassword } from '@synapse/auth'
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

function tempPassword(): string {
  const upper = () => String.fromCharCode(65 + Math.floor(Math.random() * 26))
  const digit = () => String(Math.floor(Math.random() * 10))
  return `Synapse${upper()}${upper()}${upper()}${upper()}${digit()}${digit()}${digit()}${digit()}!`
}

export async function POST(req: NextRequest) {
  const ctx = await requireHospitalAdminContext()
  if (isContextError(ctx)) return ctx

  const cap = await requireHospitalCapability(ctx, 'staff', 'write')
  if (cap) return cap

  const body = await req.json().catch(() => null)
  const parsed = staffInviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any

  const { data: dup } = await db
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (dup) {
    return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
  }

  const password = tempPassword()
  const passwordHash = await hashPassword(password)
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
    password_hash: passwordHash,
    must_change_password: true,
    onboarding_complete: false,
    verification_status: 'verified',
    created_by: ctx.userId,
  }

  const { data: profile, error } = await db.from('profiles').insert(profileRow).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: hospital } = await db
    .from('hospitals')
    .select('name')
    .eq('id', ctx.hospitalId)
    .maybeSingle()

  const hospitalName = hospital?.name ?? 'your hospital'

  try {
    await sendHospitalStaffInviteEmail({
      to: email,
      hospitalName,
      staffName: parsed.data.full_name.trim(),
      role: parsed.data.role,
      tempPassword: password,
    })
  } catch (emailErr) {
    console.error('[hospital-admin] staff invite email failed:', emailErr)
  }

  await logHospitalAudit({
    ctx,
    action: 'INSERT',
    tableName: 'profiles',
    recordId: profile.id,
    newValue: { email, role: parsed.data.role, invited: true },
  })

  return NextResponse.json(
    { staff: { id: profile.id, email, full_name: profile.full_name, role: profile.role } },
    { status: 201 },
  )
}
