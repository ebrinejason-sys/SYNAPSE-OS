// Local-only acceptance helpers. Refuses any non-loopback app or database target.
import { execFileSync } from "node:child_process"
import { createHmac, randomBytes } from "node:crypto"

export const BASE = process.env.LOCAL_ACCEPTANCE_BASE_URL || "http://localhost:3100"
const DB_CONTAINER = process.env.LOCAL_ACCEPTANCE_DB_CONTAINER || "supabase_db_synapse-os"

export function assertLocalTargets() {
  const app = new URL(BASE)
  if (!["localhost", "127.0.0.1"].includes(app.hostname)) throw new Error(`refusing non-local app target ${app.hostname}`)
  const supabase = new URL(process.env.SUPABASE_URL || "http://127.0.0.1:54321")
  if (!["localhost", "127.0.0.1"].includes(supabase.hostname)) throw new Error(`refusing non-local Supabase ${supabase.hostname}`)
  if (!process.env.SYNAPSE_E2E_PASSWORD || !/^\d{6}$/.test(process.env.SYNAPSE_E2E_FIXED_OTP || "")) {
    throw new Error("SYNAPSE_E2E_PASSWORD and SYNAPSE_E2E_FIXED_OTP must be set for the local run")
  }
}

export const EMAILS = {
  receptionist: "reception.e2e@synapseos.invalid",
  nurse: "nurse.e2e@synapseos.invalid",
  doctor: "doctor.e2e@synapseos.invalid",
  lab_technician: "labtech.e2e@synapseos.invalid",
  lab_scientist: "labscientist.e2e@synapseos.invalid",
  pharmacist: "pharmacist.e2e@synapseos.invalid",
  billing_officer: "cashier.e2e@synapseos.invalid",
  hospital_admin: "admin.e2e@synapseos.invalid",
  doctor_b: "doctor.b.e2e@synapseos.invalid",
}

export function sql(query) {
  return execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: query,
    encoding: "utf8",
  }).trim()
}

export function sqlJson(query) {
  const out = sql(`select coalesce(json_agg(t), '[]'::json) from (${query}) t`)
  return JSON.parse(out || "[]")
}

function cookiesFrom(res, jar) {
  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";")
    const i = pair.indexOf("=")
    const name = pair.slice(0, i).trim()
    const value = pair.slice(i + 1)
    if (value) jar.set(name, value)
    else jar.delete(name)
  }
}

export class Session {
  constructor(label) {
    this.label = label
    this.jar = new Map()
  }

  cookie() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ")
  }

  async call(method, path, body, headers = {}) {
    const init = {
      method,
      redirect: "manual",
      headers: {
        cookie: this.cookie(),
        ...(method === "GET" ? {} : { origin: BASE, "content-type": "application/json" }),
        ...headers,
      },
    }
    if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body)
    const res = await fetch(BASE + path, init)
    cookiesFrom(res, this.jar)
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text.slice(0, 200) }
    }
    return { status: res.status, json, headers: res.headers }
  }

  async login(email) {
    this.jar.clear()
    if (!email.endsWith(".e2e@synapseos.invalid")) throw new Error(`refusing non-synthetic account ${email}`)
    // OTP issuance is limited to 3/hour per target; the runner logs each synthetic role in repeatedly.
    sql(`delete from public.auth_otps where target = '${email}'`)
    const first = await this.call("POST", "/api/auth/password-login", { email, password: process.env.SYNAPSE_E2E_PASSWORD })
    if (first.status >= 300) throw new Error(`${this.label} password-login HTTP ${first.status} ${JSON.stringify(first.json)}`)
    const verify = await this.call("POST", "/api/auth/email-otp/verify", { email, otp: process.env.SYNAPSE_E2E_FIXED_OTP })
    if (verify.status >= 300 || !this.jar.has("synapse_session")) {
      throw new Error(`${this.label} otp verify HTTP ${verify.status} ${JSON.stringify(verify.json)}`)
    }
    return this
  }
}

export async function loginAs(role, email = EMAILS[role]) {
  return new Session(role).login(email)
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32(bytes) {
  let bits = 0, value = 0, out = ""
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 0x1f]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 0x1f]
  return out
}

function unbase32(input) {
  const bytes = []
  let bits = 0, value = 0
  for (const ch of input) {
    value = (value << 5) | B32.indexOf(ch)
    bits += 5
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8 }
  }
  return Buffer.from(bytes)
}

export function totp(secret, step = Math.floor(Date.now() / 30000)) {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const mac = createHmac("sha1", unbase32(secret)).update(counter).digest()
  const off = mac[19] & 0xf
  return String((mac.readUInt32BE(off) & 0x7fffffff) % 1_000_000).padStart(6, "0")
}

/**
 * Creates or resets a synthetic control-plane user in the local DB: platform profile,
 * the shared synthetic password hash, an ACTIVE membership and a verified TOTP enrollment.
 */
export function ensurePlatformUser({ email, name, profileRole = "platform_admin", platformRole = "PLATFORM_ADMIN", createdAt = null, mustChangePassword = false }) {
  if (!email.endsWith(".e2e@synapseos.invalid")) throw new Error(`refusing non-synthetic account ${email}`)
  const secret = base32(randomBytes(20))
  const id = sql(`
with existing as (select id from profiles where lower(email) = '${email}'),
ins as (
  insert into profiles (id, email, full_name, role, verification_status, email_verified_at, is_deleted, password_hash, must_change_password, created_at)
  select gen_random_uuid(), '${email}', '${name}', '${profileRole}', 'verified', now(), false,
    (select password_hash from profiles where lower(email) = '${EMAILS.hospital_admin}'), ${mustChangePassword}, ${createdAt ? `'${createdAt}'` : "now()"}
  where not exists (select 1 from existing)
  returning id
)
select id from ins union all select id from existing;`).split("\n").pop()
  sql(`update profiles set role='${profileRole}', is_deleted=false, verification_status='verified', email_verified_at=coalesce(email_verified_at, now()),
  login_attempts=0, locked_until=null, must_change_password=${mustChangePassword},
  password_hash=(select password_hash from profiles where lower(email) = '${EMAILS.hospital_admin}')${createdAt ? `, created_at='${createdAt}'` : ""}
  where id='${id}';
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('${id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${email}', now(), now())
on conflict (id) do nothing;
delete from platform_memberships where user_id='${id}';
insert into platform_memberships (user_id, platform_role, status, accepted_at, mfa_required) values ('${id}', '${platformRole}', 'ACTIVE', now(), true);
delete from mfa_enrollments where user_id='${id}';
insert into mfa_enrollments (user_id, secret, verified) values ('${id}', '${secret}', true);
delete from synapse_sessions where user_id='${id}';`)
  return { id, email, secret }
}

export async function platformLogin(user, label = user.email) {
  const s = new Session(label)
  if (!user.email.endsWith(".e2e@synapseos.invalid")) throw new Error(`refusing non-synthetic account ${user.email}`)
  const first = await s.call("POST", "/api/auth/password-login", { email: user.email, password: process.env.SYNAPSE_E2E_PASSWORD })
  if (first.status !== 200 || !first.json?.mfaRequired) throw new Error(`${label} password-login HTTP ${first.status} ${JSON.stringify(first.json)}`)
  const mfa = await s.call("POST", "/api/auth/mfa/verify", { code: totp(user.secret) })
  if (mfa.status >= 300 || !s.jar.has("synapse_session")) throw new Error(`${label} mfa verify HTTP ${mfa.status} ${JSON.stringify(mfa.json)}`)
  return s
}

export class Report {
  constructor(name) {
    this.name = name
    this.checks = []
  }

  check(id, ok, detail = "") {
    this.checks.push({ id, ok: Boolean(ok), detail: typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400) })
    console.log(`${ok ? "PASS" : "FAIL"} ${id}${ok ? "" : ` :: ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)}`}`)
    return Boolean(ok)
  }

  expectStatus(id, res, expected) {
    const list = Array.isArray(expected) ? expected : [expected]
    return this.check(id, list.includes(res.status), `HTTP ${res.status} ${JSON.stringify(res.json).slice(0, 300)}`)
  }

  summary() {
    const failed = this.checks.filter((c) => !c.ok)
    console.log(`\n${this.name}: ${this.checks.length - failed.length}/${this.checks.length} passed`)
    return failed.length === 0
  }
}
