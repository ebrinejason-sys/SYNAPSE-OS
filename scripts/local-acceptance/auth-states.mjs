#!/usr/bin/env node
// Local account-state and anti-enumeration rerun. Pre-proof endpoints must answer every
// state exactly like an unknown email; state-specific answers only follow a proven password.
import { randomInt } from "node:crypto"
import { assertLocalTargets, EMAILS, loginAs, Report, Session, sql } from "./lib.mjs"

assertLocalTargets()
const r = new Report("auth-states")
const PASSWORD = process.env.SYNAPSE_E2E_PASSWORD
const receptionId = sql(`select id from profiles where lower(email)='${EMAILS.receptionist}'`)

const STATES = {
  active: "state-active.e2e@synapseos.invalid",
  unverified: "state-unverified.e2e@synapseos.invalid",
  suspended: "state-suspended.e2e@synapseos.invalid",
  archived: "state-archived.e2e@synapseos.invalid",
  locked: "state-locked.e2e@synapseos.invalid",
}
const UNKNOWN = `nobody-${Date.now().toString(36)}.e2e@synapseos.invalid`

for (const [state, email] of Object.entries(STATES)) {
  const id = sql(`select coalesce((select id::text from profiles where lower(email)='${email}'), gen_random_uuid()::text)`)
  sql(`delete from platform_memberships where user_id='${id}';
insert into profiles (id, email, full_name, role, tenant_id, hospital_id, verification_status, email_verified_at, password_hash, is_deleted, created_at)
select '${id}', '${email}', 'State ${state}', role, tenant_id, hospital_id, 'verified', now(), password_hash, false, now() from profiles where id='${receptionId}'
on conflict (id) do nothing;
update profiles p set password_hash=src.password_hash, role=src.role, tenant_id=src.tenant_id, verification_status='verified', email_verified_at=now(),
  is_deleted=false, locked_until=null, login_attempts=0, must_change_password=false
from profiles src where src.id='${receptionId}' and p.id='${id}';`)
  if (state === "unverified") sql(`update profiles set email_verified_at=null where id='${id}'`)
  if (state === "archived") sql(`update profiles set is_deleted=true where id='${id}'`)
  if (state === "locked") sql(`update profiles set locked_until=now() + interval '1 hour' where id='${id}'`)
  if (state === "suspended") {
    sql(`insert into platform_memberships (user_id, platform_role, status, metadata) values ('${id}', 'READ_ONLY_OBSERVER', 'SUSPENDED', '{"account_suspension":{"marker":true,"previous_status":null}}')`)
  }
  sql(`delete from auth_otps where target='${email}'`)
}

const anon = () => new Session("anon")
const fromIp = () => ({ "x-forwarded-for": `10.${randomInt(255)}.${randomInt(255)}.${randomInt(255)}` })
const shape = (res) => JSON.stringify({ status: res.status, body: res.json })

// Pre-proof endpoints: every state must be byte-identical to an unknown email.
const preProof = [
  ["password_reset_request", (email) => anon().call("POST", "/api/auth/password-reset/request", { email }, fromIp())],
  ["activation_resend", (email) => anon().call("POST", "/api/auth/activation/resend", { email }, fromIp())],
  ["email_otp_send", (email) => anon().call("POST", "/api/auth/email-otp/send", { email }, fromIp())],
  ["mobile_forgot_password", (email) => anon().call("POST", "/api/auth/mobile/forgot-password", { email }, fromIp())],
  ["password_login_wrong_password", (email) => anon().call("POST", "/api/auth/password-login", { email, password: "Wrong-Password-1!" }, fromIp())],
  ["mobile_login_wrong_password", (email) => anon().call("POST", "/api/auth/mobile/login", { email, password: "Wrong-Password-1!" }, fromIp())],
]
for (const [id, callFor] of preProof) {
  const baseline = shape(await callFor(UNKNOWN))
  for (const [state, email] of Object.entries(STATES)) {
    if (id.endsWith("wrong_password")) sql(`update profiles set login_attempts=0 where lower(email)='${email}'`)
    const got = shape(await callFor(email))
    // A locked account refuses before checking the password; that is disclosed only as a lockout.
    const expectLock = state === "locked" && id.endsWith("wrong_password")
    r.check(`no_enumeration.${id}.${state}`, expectLock ? JSON.parse(got).status === 429 : got === baseline, `${got} vs unknown ${baseline}`)
  }
  const known = shape(await callFor(EMAILS.receptionist))
  r.check(`no_enumeration.${id}.known_active_e2e`, known === baseline, `${known} vs unknown ${baseline}`)
}
for (const [state, email] of Object.entries(STATES)) sql(`update profiles set login_attempts=0 where lower(email)='${email}'`)
sql(`update profiles set locked_until=now() + interval '1 hour' where lower(email)='${STATES.locked}'`)

// Post-proof: a correct password earns a state-specific answer.
const proven = async (email) => anon().call("POST", "/api/auth/password-login", { email, password: PASSWORD }, fromIp())
const expectState = [
  ["unverified", 403, (j) => j?.code === "ACCOUNT_UNVERIFIED" && j?.activationRequired === true],
  ["suspended", 403, (j) => typeof j?.error === "string"],
  ["archived", 403, (j) => typeof j?.error === "string"],
  ["locked", 429, (j) => /locked/i.test(j?.error ?? "")],
]
for (const [state, status, bodyOk] of expectState) {
  const res = await proven(STATES[state])
  r.check(`post_proof.${state}`, res.status === status && bodyOk(res.json), shape(res))
  r.check(`post_proof.${state}.no_session`, !res.headers.get("set-cookie")?.includes("synapse_session="), "session cookie issued")
}
const archivedMobile = await anon().call("POST", "/api/auth/mobile/login", { email: STATES.archived, password: PASSWORD }, fromIp())
r.check("post_proof.mobile.archived_blocked", archivedMobile.status === 403, shape(archivedMobile))

// Delivery failure after a proven password is reported honestly and issues no session.
const delivery = await proven(STATES.active)
r.check("post_proof.active.delivery_failure_reported", delivery.status === 500 && /send/i.test(delivery.json?.error ?? ""), shape(delivery))
r.check("post_proof.active.delivery_failure_no_session", !delivery.headers.get("set-cookie")?.includes("synapse_session="))

// Password change required: sign-in completes and the client is told to change the password.
try {
  sql(`update profiles set must_change_password=true where id='${receptionId}'`)
  sql(`delete from auth_otps where target='${EMAILS.receptionist}'`)
  const s = new Session("pwchange")
  await s.call("POST", "/api/auth/password-login", { email: EMAILS.receptionist, password: PASSWORD })
  const verify = await s.call("POST", "/api/auth/email-otp/verify", { email: EMAILS.receptionist, otp: process.env.SYNAPSE_E2E_FIXED_OTP })
  r.check("password_change_required.routed_to_reset", verify.status === 200 && verify.json?.redirectTo === "/reset-password", shape(verify))
} finally {
  sql(`update profiles set must_change_password=false where id='${receptionId}'`)
}

// Email OTP verification: wrong codes are capped and never reveal the right one.
sql(`delete from auth_otps where target='${EMAILS.receptionist}'`)
const otpSession = new Session("otp")
await otpSession.call("POST", "/api/auth/password-login", { email: EMAILS.receptionist, password: PASSWORD })
const wrongOtp = String((Number(process.env.SYNAPSE_E2E_FIXED_OTP) + 1) % 1_000_000).padStart(6, "0")
const attempts = []
for (let i = 0; i < 6; i++) attempts.push((await otpSession.call("POST", "/api/auth/email-otp/verify", { email: EMAILS.receptionist, otp: wrongOtp })).status)
r.check("email_otp.wrong_codes_rejected", attempts.every((s) => s >= 400), attempts.join(","))
const afterCap = await otpSession.call("POST", "/api/auth/email-otp/verify", { email: EMAILS.receptionist, otp: process.env.SYNAPSE_E2E_FIXED_OTP })
r.check("email_otp.locked_after_attempt_cap", afterCap.status >= 400 && !otpSession.jar.has("synapse_session"), shape(afterCap))
const fresh = await loginAs("receptionist")
r.check("email_otp.fresh_code_signs_in", fresh.jar.has("synapse_session"))

// Activation resend and password reset for an unverified account never sign anyone in.
const resend = await anon().call("POST", "/api/auth/activation/resend", { email: STATES.unverified }, fromIp())
r.check("activation_resend.unverified_generic", shape(resend) === JSON.stringify({ status: 200, body: { ok: true } }), shape(resend))

process.exit(r.summary() ? 0 : 1)
