// Billing expiry sweep against a LOCAL Supabase: runs the same RPC the nightly cron
// (/api/cron/billing-sweep) calls and checks that only expired subscriptions move.
// Skipped unless LOCAL_API_URL/LOCAL_SERVICE_ROLE_KEY point at 127.0.0.1/localhost.
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const URL_ = process.env.LOCAL_API_URL ?? ""
const KEY = process.env.LOCAL_SERVICE_ROLE_KEY ?? ""
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(URL_) && KEY.length > 0
const skip = isLocal ? false : "local Supabase env not set (LOCAL_API_URL / LOCAL_SERVICE_ROLE_KEY)"
const db = isLocal ? createClient(URL_, KEY, { auth: { persistSession: false } }) : null

const at = (days) => new Date(Date.now() + days * 864e5).toISOString()
const tenants = {}

// Same rule as packages/auth evaluateEntitlement for the statuses used here.
const entitled = (s) =>
  (s.status === "active" || s.status === "trialing")
    ? !(s.current_period_end && new Date(s.current_period_end) < new Date()) ||
      Boolean(s.grace_until && new Date(s.grace_until) >= new Date())
    : s.status === "past_due"
      ? Boolean(s.grace_until && new Date(s.grace_until) >= new Date())
      : false

async function tenantWith(label, sub) {
  const slug = `zz-billing-${label}-${randomUUID().slice(0, 8)}`
  const { data: t, error } = await db.from("tenants").insert({ name: `ZZ Billing ${label}`, slug, is_synthetic: true }).select("id").single()
  if (error) throw error
  const { data: plan } = await db.from("subscription_plans").select("id").eq("slug", "synapse_pharmacy_annual").single()
  const { error: se } = await db.from("tenant_subscriptions").insert({ tenant_id: t.id, plan_id: plan.id, ...sub })
  if (se) throw se
  tenants[label] = t.id
  return t.id
}

const subOf = async (id) =>
  (await db.from("tenant_subscriptions").select("status, current_period_end, grace_until").eq("tenant_id", id).single()).data

describe("billing expiry sweep (local Postgres)", { skip }, () => {
  before(async () => {
    // Production carries platform_billing_config 'subscription' (grace_days 5); a bare local DB may not.
    const { data: cfg } = await db.from("platform_billing_config").select("key").eq("key", "subscription").maybeSingle()
    if (!cfg) await db.from("platform_billing_config").insert({ key: "subscription", value: { grace_days: 5 } })
    await tenantWith("active", { status: "active", current_period_start: at(-30), current_period_end: at(335) })
    await tenantWith("expired", { status: "active", current_period_start: at(-400), current_period_end: at(-35) })
    await tenantWith("trial-over", { status: "trialing", trial_ends: at(-1), current_period_end: at(-1) })
    await tenantWith("grace-over", { status: "past_due", current_period_end: at(-40), grace_until: at(-1) })
  })

  after(async () => {
    for (const id of Object.values(tenants)) await db.from("tenants").update({ lifecycle_status: "ARCHIVED" }).eq("id", id).then(() => {}, () => {})
  })

  it("advance_all_subscriptions moves only expired subscriptions; an active one is untouched", async () => {
    const before = await subOf(tenants.active)
    const { data, error } = await db.rpc("advance_all_subscriptions", { p_actor: "cron" })
    assert.equal(error, null)
    assert.ok(data.checked >= 4)

    const active = await subOf(tenants.active)
    assert.deepEqual(active, before, "active, in-period subscription untouched")
    assert.equal(entitled(active), true)

    const expired = await subOf(tenants.expired)
    assert.equal(expired.status, "past_due")
    assert.ok(expired.grace_until, "grace window opened")

    assert.equal((await subOf(tenants["trial-over"])).status, "past_due")

    const graceOver = await subOf(tenants["grace-over"])
    assert.equal(graceOver.status, "suspended")
    assert.equal(entitled(graceOver), false, "expired past grace loses entitlement")
  })

  it("a second run is idempotent for the active subscription and keeps suspended suspended", async () => {
    await db.rpc("advance_all_subscriptions", { p_actor: "cron" })
    assert.equal((await subOf(tenants.active)).status, "active")
    assert.equal((await subOf(tenants["grace-over"])).status, "suspended")
  })

  it("an expired subscription is denied by entitlement even before the sweep runs", async () => {
    // Request-time evaluation is date based, so a missing cron run cannot keep an expired tenant entitled.
    assert.equal(entitled({ status: "active", current_period_end: at(-2), grace_until: null }), false)
    assert.equal(entitled({ status: "active", current_period_end: at(10), grace_until: null }), true)
  })
})
