import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requirePlatformAdminApi } from '@/lib/platform/auth'
import { logPlatformEvent } from '@/app/platform/_lib/platform-data'

export const dynamic = 'force-dynamic'

const SUBJECT_TYPES = new Set(['USER', 'TENANT', 'FACILITY', 'PHARMACY', 'LABORATORY', 'CLINIC', 'HOSPITAL', 'ORGANIZATION'])
const GRANT_TYPES = new Set(['MANUAL', 'TRIAL', 'PROMOTIONAL', 'COMPASSIONATE', 'STAFF', 'PARTNER', 'PILOT', 'OTHER'])

function bad(message: string) { return NextResponse.json({ error: message }, { status: 400 }) }

export async function GET(request: Request) {
  const access = await requirePlatformAdminApi('platform.subscription.read')
  if (!access.ok) return access.response
  const params = new URL(request.url).searchParams
  const db = createServiceClient() as any
  let query = db.from('subscription_grants').select('*, subscription_plans(slug, name)').order('created_at', { ascending: false }).limit(200)
  const tenantId = params.get('tenant_id')
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ grants: data ?? [] })
}

export async function POST(request: Request) {
  const access = await requirePlatformAdminApi('platform.subscription.manage')
  if (!access.ok) return access.response
  const body = request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')
    ? Object.fromEntries((await request.formData()).entries())
    : await request.json().catch(() => ({})) as Record<string, unknown>
  const subjectType = String(body.subject_type ?? '')
  const subjectId = String(body.subject_id ?? '')
  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : null
  const startsAt = String(body.starts_at ?? '')
  const endsAt = String(body.ends_at ?? '')
  const reason = String(body.reason ?? '').trim()
  const grantType = String(body.grant_type ?? 'MANUAL')
  if (!SUBJECT_TYPES.has(subjectType) || !subjectId || !startsAt || !endsAt || !reason) return bad('subject_type, subject_id, starts_at, ends_at, and reason are required')
  if (!GRANT_TYPES.has(grantType)) return bad('Invalid grant_type')
  if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt)) return bad('ends_at must be after starts_at')
  const db = createServiceClient() as any
  const planSlug = typeof body.plan_slug === 'string' ? body.plan_slug : null
  let planId: string | null = null
  if (planSlug) {
    const { data: plan, error: planError } = await db.from('subscription_plans').select('id').eq('slug', planSlug).eq('is_active', true).maybeSingle()
    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 })
    if (!plan) return bad('Unknown or inactive plan')
    planId = plan.id
  }
  const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : null
  if (idempotencyKey) {
    const { data: existing } = await db.from('subscription_grants').select('*').eq('idempotency_key', idempotencyKey).maybeSingle()
    if (existing) return NextResponse.json({ grant: existing, duplicate: true })
  }
  const now = new Date()
  const status = new Date(startsAt) > now ? 'SCHEDULED' : 'ACTIVE'
  const { data: grant, error } = await db.from('subscription_grants').insert({
    subject_type: subjectType,
    subject_id: subjectId,
    tenant_id: tenantId,
    facility_id: typeof body.facility_id === 'string' ? body.facility_id : null,
    plan_id: planId,
    grant_type: grantType,
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    reason,
    notes: typeof body.notes === 'string' ? body.notes : null,
    created_by: access.profile.id,
    approved_by: access.profile.id,
    source: 'PLATFORM_ADMIN',
    metadata: { payment_status: 'NOT_REQUIRED' },
    idempotency_key: idempotencyKey,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logPlatformEvent({ actorId: access.profile.id, action: 'SubscriptionGrantCreated', entityType: 'subscription_grants', entityId: grant.id, tenantId, metadata: { subject_type: subjectType, subject_id: subjectId, starts_at: startsAt, ends_at: endsAt, grant_type: grantType, payment_status: 'NOT_REQUIRED', reason } })
  return NextResponse.json({ grant }, { status: 201 })
}

export async function PATCH(request: Request) {
  const access = await requirePlatformAdminApi('platform.subscription.manage')
  if (!access.ok) return access.response
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const id = String(body.id ?? '')
  const action = String(body.action ?? '')
  const reason = String(body.reason ?? '').trim()
  if (!id || !reason) return bad('id and reason are required')
  const db = createServiceClient() as any
  const { data: current, error: lookupError } = await db.from('subscription_grants').select('*').eq('id', id).maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'Grant not found' }, { status: 404 })
  let updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  let auditAction = 'SubscriptionGrantChanged'
  if (action === 'revoke') {
    updates = { ...updates, status: 'REVOKED', revoked_at: new Date().toISOString(), revoked_by: access.profile.id, revoke_reason: reason }
    auditAction = 'SubscriptionGrantRevoked'
  } else if (action === 'extend' || action === 'shorten') {
    const endsAt = String(body.ends_at ?? '')
    if (!Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(current.starts_at)) return bad('ends_at must be after starts_at')
    updates = { ...updates, ends_at: endsAt, status: Date.parse(endsAt) > Date.now() ? (Date.parse(current.starts_at) > Date.now() ? 'SCHEDULED' : 'ACTIVE') : 'EXPIRED', metadata: { ...(current.metadata ?? {}), last_change_reason: reason } }
    auditAction = action === 'extend' ? 'SubscriptionGrantExtended' : 'SubscriptionGrantChanged'
  } else return bad('action must be revoke, extend, or shorten')
  const { data: grant, error } = await db.from('subscription_grants').update(updates).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logPlatformEvent({ actorId: access.profile.id, action: auditAction, entityType: 'subscription_grants', entityId: id, tenantId: current.tenant_id, oldValue: current, metadata: { ...updates, reason } })
  return NextResponse.json({ grant })
}
