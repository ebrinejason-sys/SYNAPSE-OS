import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@synapse/db/admin'
import { sendRenewalReminder, sendPastDueNotice, sendSuspensionNotice } from '@synapse/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Nightly billing sweep — Vercel cron (00:15 Africa/Kampala = 21:15 UTC).
 *
 * 1. Advances the subscription state machine (advance_all_subscriptions):
 *      trialing/active past their end date → past_due (+5-day grace)
 *      past_due past grace_until          → suspended
 *    Never auto-cancels, never deletes — suspend only.
 * 2. Emails tenant admins on each transition (past_due / suspended notices)
 *    and sends T−3-day renewal / trial-expiry reminders (deduped per period).
 * 3. G2 sweep: purges auth_otps older than 15 min and password_reset_tokens
 *    older than 60 min.
 * 4. Records the run in platform_billing_config (key 'billing_sweep_last_run')
 *    for the platform-health dashboard.
 */

const REMINDER_WINDOW_DAYS = 3
const OTP_MAX_AGE_MIN = 15
const RESET_TOKEN_MAX_AGE_MIN = 60
const MAX_EMAILS_PER_RUN = 200

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any

const PAY_URL = `${process.env.NEXT_PUBLIC_PHARMACY_APP_URL ?? 'https://pharm.synapseos.tech'}/portal/billing`

type AdminRecipient = { email: string; full_name: string | null }

async function tenantAdmins(tenantId: string): Promise<AdminRecipient[]> {
  const { data } = await db()
    .from('profiles')
    .select('email, full_name')
    .eq('tenant_id', tenantId)
    .or('is_admin.eq.true,role.eq.pharmacy_admin')
    .not('email', 'is', null)
    .limit(5)
  return (data ?? []) as AdminRecipient[]
}

async function tenantName(tenantId: string): Promise<string> {
  const { data } = await db().from('tenants').select('name').eq('id', tenantId).maybeSingle()
  return data?.name ?? 'Your pharmacy'
}

async function purgeStale(table: string, column: string, maxAgeMinutes: number): Promise<{ before: number; deleted: number }> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString()
  const { count: before } = await db().from(table).select('id', { count: 'exact', head: true }).lt(column, cutoff)
  const { count: deleted } = await db().from(table).delete({ count: 'exact' }).lt(column, cutoff)
  return { before: before ?? 0, deleted: deleted ?? 0 }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Fail closed — an unconfigured secret must not leave the sweep publicly callable.
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  const alt = req.headers.get('x-cron-secret')
  if (auth !== `Bearer ${secret}` && alt !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runStartedAt = new Date().toISOString()
  const emailLog: Array<{ type: string; tenant_id: string; to: string; ok: boolean }> = []
  let emailBudget = MAX_EMAILS_PER_RUN

  async function notify(
    type: string,
    tenantId: string,
    send: (to: AdminRecipient, pharmacy: string) => Promise<void>,
  ): Promise<void> {
    if (emailBudget <= 0) return
    const pharmacy = await tenantName(tenantId)
    for (const admin of await tenantAdmins(tenantId)) {
      if (emailBudget <= 0) return
      emailBudget -= 1
      try {
        await send(admin, pharmacy)
        emailLog.push({ type, tenant_id: tenantId, to: admin.email, ok: true })
      } catch {
        emailLog.push({ type, tenant_id: tenantId, to: admin.email, ok: false })
      }
    }
  }

  // ── 1. State machine ────────────────────────────────────────────────────────
  const { data: sweepResult, error: sweepErr } = await db().rpc('advance_all_subscriptions', {
    p_actor: 'cron',
  })
  if (sweepErr) {
    return NextResponse.json({ error: sweepErr.message }, { status: 500 })
  }

  // ── 2a. Transition notices (events written by this run) ────────────────────
  const { data: transitions } = await db()
    .from('subscription_events')
    .select('tenant_id, to_status, metadata')
    .eq('actor', 'cron')
    .in('to_status', ['past_due', 'suspended'])
    .gte('created_at', runStartedAt)

  for (const ev of transitions ?? []) {
    if (ev.to_status === 'past_due') {
      const { data: sub } = await db()
        .from('tenant_subscriptions')
        .select('grace_until')
        .eq('tenant_id', ev.tenant_id)
        .maybeSingle()
      await notify('past_due_notice', ev.tenant_id, (admin, pharmacy) =>
        sendPastDueNotice({
          to: admin.email,
          name: admin.full_name ?? '',
          pharmacyName: pharmacy,
          graceUntil: sub?.grace_until ?? null,
          payUrl: PAY_URL,
        }),
      )
    } else if (ev.to_status === 'suspended') {
      await notify('suspension_notice', ev.tenant_id, (admin, pharmacy) =>
        sendSuspensionNotice({
          to: admin.email,
          name: admin.full_name ?? '',
          pharmacyName: pharmacy,
          payUrl: PAY_URL,
        }),
      )
    }
  }

  // ── 2b. T−3 renewal / trial reminders (deduped per period via events) ──────
  const horizon = new Date(Date.now() + REMINDER_WINDOW_DAYS * 24 * 60 * 60_000).toISOString()
  const nowIso = new Date().toISOString()
  let remindersSent = 0

  const remind = async (
    rows: Array<{ tenant_id: string; due: string; plan: { name?: string; price_ugx?: number } | null }>,
    kind: 'renewal' | 'trial',
  ) => {
    const reason = kind === 'trial' ? 'trial_reminder' : 'renewal_reminder'
    for (const row of rows) {
      // one reminder per tenant per period-end — dedup on the logged event
      const { data: already } = await db()
        .from('subscription_events')
        .select('id')
        .eq('tenant_id', row.tenant_id)
        .eq('reason', reason)
        .eq('metadata->>due', row.due)
        .limit(1)
      if (already && already.length > 0) continue

      await notify(reason, row.tenant_id, (admin, pharmacy) =>
        sendRenewalReminder({
          to: admin.email,
          name: admin.full_name ?? '',
          pharmacyName: pharmacy,
          planName: row.plan?.name ?? 'Synapse Pharm',
          amountUgx: Number(row.plan?.price_ugx ?? 0),
          periodEnd: row.due,
          payUrl: PAY_URL,
          kind,
        }),
      )
      await db().from('subscription_events').insert({
        tenant_id: row.tenant_id,
        from_status: null,
        to_status: null,
        reason,
        actor: 'cron',
        metadata: { due: row.due },
      })
      remindersSent += 1
    }
  }

  const { data: renewals } = await db()
    .from('tenant_subscriptions')
    .select('tenant_id, current_period_end, cancel_at_period_end, subscription_plans ( name, price_ugx )')
    .eq('status', 'active')
    .gte('current_period_end', nowIso)
    .lte('current_period_end', horizon)
  await remind(
    (renewals ?? [])
      .filter((r: { cancel_at_period_end: boolean | null }) => !r.cancel_at_period_end)
      .map((r: { tenant_id: string; current_period_end: string; subscription_plans: { name?: string; price_ugx?: number } | null }) => ({
        tenant_id: r.tenant_id,
        due: r.current_period_end,
        plan: r.subscription_plans,
      })),
    'renewal',
  )

  const { data: trials } = await db()
    .from('tenant_subscriptions')
    .select('tenant_id, trial_ends, subscription_plans ( name, price_ugx )')
    .in('status', ['trialing', 'trial'])
    .gte('trial_ends', nowIso)
    .lte('trial_ends', horizon)
  await remind(
    (trials ?? []).map((r: { tenant_id: string; trial_ends: string; subscription_plans: { name?: string; price_ugx?: number } | null }) => ({
      tenant_id: r.tenant_id,
      due: r.trial_ends,
      plan: r.subscription_plans,
    })),
    'trial',
  )

  // ── 3. G2: stale token purge ────────────────────────────────────────────────
  const otps = await purgeStale('auth_otps', 'created_at', OTP_MAX_AGE_MIN)
  const resetTokens = await purgeStale('password_reset_tokens', 'created_at', RESET_TOKEN_MAX_AGE_MIN)

  const result = {
    ok: true,
    started_at: runStartedAt,
    state_machine: sweepResult,
    transitions: (transitions ?? []).length,
    reminders_sent: remindersSent,
    emails: emailLog,
    token_cleanup: {
      auth_otps: otps,
      password_reset_tokens: resetTokens,
    },
  }

  // ── 4. Record the run for the platform-health page ─────────────────────────
  await db()
    .from('platform_billing_config')
    .upsert(
      { key: 'billing_sweep_last_run', value: result, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )

  return NextResponse.json(result)
}
