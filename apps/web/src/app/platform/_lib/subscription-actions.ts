'use server'

// Platform-admin billing controls. Suspend/reactivate flip
// tenant_subscriptions.status ONLY — tenant data is never touched; the
// pharmacy middleware turns a suspended subscription into HTTP 402.
// Every action appends to the audit_log ledger (the live audit table —
// the brief's admin_audit_log) with before/after JSON.

import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin } from '../../../lib/platform/auth'
import { createServiceClient } from '../../../lib/supabase/server'
import { logPlatformEvent, logSubscriptionEvent } from './platform-data'

type SubSnapshot = {
  id?: string
  status?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
  grace_until?: string | null
} | null

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServiceClient() as any
}

async function loadSubscription(tenantId: string): Promise<SubSnapshot> {
  const { data } = await db()
    .from('tenant_subscriptions')
    .select('id, status, current_period_start, current_period_end, grace_until')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data ?? null
}

function revalidateBillingViews() {
  revalidatePath('/platform/hospitals')
  revalidatePath('/platform/billing')
  revalidatePath('/platform')
}

async function setSubscriptionStatus(
  tenantId: string,
  status: 'active' | 'suspended',
  action: string,
) {
  const admin = await requirePlatformAdmin()
  if (!tenantId) return

  const before = await loadSubscription(tenantId)
  if (!before?.id) {
    console.warn(`[platform] ${action}: tenant ${tenantId} has no tenant_subscriptions row`)
    return
  }

  const { error } = await db()
    .from('tenant_subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
  if (error) {
    console.error(`[platform] ${action} failed:`, error.message)
    return
  }

  await logPlatformEvent({
    actorId: admin.id,
    action,
    entityType: 'tenant_subscriptions',
    entityId: before.id,
    tenantId,
    oldValue: { status: before.status },
    metadata: { status },
  })
  await logSubscriptionEvent({
    tenantId,
    fromStatus: before.status,
    toStatus: status,
    reason: action,
    actor: admin.email,
  })
  revalidateBillingViews()
}

export async function suspendSubscription(formData: FormData) {
  await setSubscriptionStatus(String(formData.get('tenantId') ?? ''), 'suspended', 'subscription.suspended')
}

export async function reactivateSubscription(formData: FormData) {
  await setSubscriptionStatus(String(formData.get('tenantId') ?? ''), 'active', 'subscription.reactivated')
}

export async function extendSubscriptionPeriod(formData: FormData) {
  const admin = await requirePlatformAdmin()
  const tenantId = String(formData.get('tenantId') ?? '')
  const days = Math.min(Math.max(Number(formData.get('days') ?? 30), 1), 366)
  if (!tenantId) return

  const before = await loadSubscription(tenantId)
  if (!before?.id) {
    console.warn(`[platform] subscription.extended: tenant ${tenantId} has no tenant_subscriptions row`)
    return
  }

  // Extend from the current period end if it is still in the future, else from now.
  const now = Date.now()
  const currentEnd = before.current_period_end ? new Date(before.current_period_end).getTime() : now
  const base = Number.isNaN(currentEnd) || currentEnd < now ? now : currentEnd
  const newEnd = new Date(base + days * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await db()
    .from('tenant_subscriptions')
    .update({
      current_period_end: newEnd,
      grace_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
  if (error) {
    console.error('[platform] subscription.extended failed:', error.message)
    return
  }

  await logPlatformEvent({
    actorId: admin.id,
    action: 'subscription.extended',
    entityType: 'tenant_subscriptions',
    entityId: before.id,
    tenantId,
    oldValue: { current_period_end: before.current_period_end, grace_until: before.grace_until },
    metadata: { current_period_end: newEnd, extended_days: days },
  })
  await logSubscriptionEvent({
    tenantId,
    fromStatus: before.status,
    toStatus: before.status,
    reason: `extended_${days}d`,
    actor: admin.email,
    metadata: { current_period_end: newEnd },
  })
  revalidateBillingViews()
}
