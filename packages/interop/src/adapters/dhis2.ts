/**
 * DHIS2 outbound adapter — live HTTP or simulation (no network).
 */

import type {
  Dhis2Adapter,
  Dhis2AdapterMode,
  Dhis2DataValue,
  Dhis2HealthStatus,
  Dhis2PushResult,
} from "../dhis2/types"

export type Dhis2Auth =
  | { type: "basic"; username: string; password: string }
  | { type: "token"; token: string }
  | { type: "none" }

export type CreateDhis2AdapterOptions = {
  baseUrl?: string | null
  auth?: Dhis2Auth
  mode: Dhis2AdapterMode
}

export type RecordedDhis2Call = {
  at: string
  method: "pushDataValueSet" | "healthCheck"
  period?: string
  orgUnit?: string
  dataSet?: string | null
  values?: Dhis2DataValue[]
  result: unknown
}

function resolveMode(explicit: Dhis2AdapterMode | undefined): Dhis2AdapterMode {
  if (explicit) return explicit
  const fromEnv = (process.env.DHIS2_MODE ?? "").toLowerCase()
  if (fromEnv === "live" || fromEnv === "simulation") return fromEnv
  return process.env.NODE_ENV === "production" ? "live" : "simulation"
}

function authHeader(auth: Dhis2Auth | undefined): Record<string, string> {
  if (!auth || auth.type === "none") return {}
  if (auth.type === "token") return { Authorization: `Bearer ${auth.token}` }
  const raw = Buffer.from(`${auth.username}:${auth.password}`).toString("base64")
  return { Authorization: `Basic ${raw}` }
}

class Dhis2AdapterImpl implements Dhis2Adapter {
  readonly mode: Dhis2AdapterMode
  readonly recordedCalls: RecordedDhis2Call[] = []
  private readonly baseUrl: string | null
  private readonly auth: Dhis2Auth

  constructor(opts: CreateDhis2AdapterOptions) {
    this.mode = resolveMode(opts.mode)
    this.baseUrl = opts.baseUrl?.replace(/\/$/, "") || null
    this.auth = opts.auth ?? { type: "none" }
  }

  async healthCheck(): Promise<Dhis2HealthStatus> {
    const checkedAt = new Date().toISOString()
    if (this.mode === "simulation") {
      const status: Dhis2HealthStatus = {
        ok: true,
        mode: "simulation",
        status: "simulation",
        detail: "Simulation adapter. Not a live national integration.",
        checkedAt,
      }
      this.recordedCalls.push({ at: checkedAt, method: "healthCheck", result: status })
      return status
    }
    if (!this.baseUrl) {
      const status: Dhis2HealthStatus = {
        ok: false,
        mode: "live",
        status: "not_configured",
        detail: "DHIS2_BASE_URL is not set",
        checkedAt,
      }
      this.recordedCalls.push({ at: checkedAt, method: "healthCheck", result: status })
      return status
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/system/info`, {
        headers: { Accept: "application/json", ...authHeader(this.auth) },
        signal: AbortSignal.timeout(8_000),
      })
      const status: Dhis2HealthStatus = {
        ok: res.ok,
        mode: "live",
        status: res.ok ? "healthy" : "degraded",
        detail: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status}`,
        checkedAt,
      }
      this.recordedCalls.push({ at: checkedAt, method: "healthCheck", result: status })
      return status
    } catch (err) {
      const status: Dhis2HealthStatus = {
        ok: false,
        mode: "live",
        status: "down",
        detail: err instanceof Error ? err.message : "health_check_failed",
        checkedAt,
      }
      this.recordedCalls.push({ at: checkedAt, method: "healthCheck", result: status })
      return status
    }
  }

  async pushDataValueSet(
    values: Dhis2DataValue[],
    period: string,
    orgUnit: string,
    options?: { dataSet?: string | null },
  ): Promise<{ ok: true; data: Dhis2PushResult } | { ok: false; code: string; message: string }> {
    const at = new Date().toISOString()
    const body = {
      dataSet: options?.dataSet ?? undefined,
      period,
      orgUnit,
      dataValues: values,
    }

    if (this.mode === "simulation") {
      const data: Dhis2PushResult = {
        importCount: values.length,
        ignored: 0,
        mode: "simulation",
        remoteResponseRef: `sim-${at}`,
      }
      this.recordedCalls.push({
        at,
        method: "pushDataValueSet",
        period,
        orgUnit,
        dataSet: options?.dataSet ?? null,
        values,
        result: data,
      })
      return { ok: true, data }
    }

    if (!this.baseUrl) {
      return { ok: false, code: "NOT_CONFIGURED", message: "DHIS2_BASE_URL is not set for live mode" }
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/dataValueSets`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...authHeader(this.auth),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        const failure = {
          ok: false as const,
          code: "DHIS2_HTTP",
          message: `DHIS2 push failed HTTP ${res.status}: ${text.slice(0, 200)}`,
        }
        this.recordedCalls.push({
          at,
          method: "pushDataValueSet",
          period,
          orgUnit,
          dataSet: options?.dataSet ?? null,
          values,
          result: failure,
        })
        return failure
      }
      const data: Dhis2PushResult = {
        importCount: values.length,
        mode: "live",
        remoteResponseRef: res.headers.get("location"),
      }
      this.recordedCalls.push({
        at,
        method: "pushDataValueSet",
        period,
        orgUnit,
        dataSet: options?.dataSet ?? null,
        values,
        result: data,
      })
      return { ok: true, data }
    } catch (err) {
      return {
        ok: false,
        code: "DHIS2_NETWORK",
        message: err instanceof Error ? err.message : "network_error",
      }
    }
  }
}

export function createDhis2Adapter(opts: CreateDhis2AdapterOptions): Dhis2Adapter & {
  recordedCalls: RecordedDhis2Call[]
} {
  return new Dhis2AdapterImpl(opts)
}

/** Env-driven factory used by platform actions. Defaults to simulation outside production. */
export function createDhis2AdapterFromEnv(): Dhis2Adapter & { recordedCalls: RecordedDhis2Call[] } {
  const mode = resolveMode(undefined)
  const baseUrl = process.env.DHIS2_BASE_URL ?? process.env.DHIS2_URL ?? null
  const username = process.env.DHIS2_USERNAME ?? ""
  const password = process.env.DHIS2_PASSWORD ?? process.env.DHIS2_TOKEN ?? ""
  const token = process.env.DHIS2_TOKEN ?? ""

  let auth: Dhis2Auth = { type: "none" }
  if (token && !username) auth = { type: "token", token }
  else if (username) auth = { type: "basic", username, password }

  return createDhis2Adapter({ baseUrl, auth, mode })
}

export function getDhis2ModeFromEnv(): Dhis2AdapterMode {
  return resolveMode(undefined)
}
