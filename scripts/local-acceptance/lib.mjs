// Local-only acceptance helpers. Refuses any non-loopback app or database target.
import { execFileSync } from "node:child_process"

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
