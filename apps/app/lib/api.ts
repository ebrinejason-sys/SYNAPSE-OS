import Constants from 'expo-constants'

/** Apex redirects POST to www; Android fetch often drops the body on that redirect. */
function resolveApiBaseUrl(): string {
  const raw = (
    (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ?? 'https://www.synapseos.tech'
  ).replace(/\/$/, '')
  try {
    const url = new URL(raw)
    if (url.hostname === 'synapseos.tech') {
      url.hostname = 'www.synapseos.tech'
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return 'https://www.synapseos.tech'
  }
}

const BASE_URL = resolveApiBaseUrl()

/** Absolute API base URL (e.g. for building document/print URLs). */
export function apiBaseUrl(): string {
  return BASE_URL
}

const DEFAULT_TIMEOUT_MS = 45_000

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

/** Non-2xx API response. `status` lets callers branch (401 → re-login,
 * 402 → billing-locked screen) instead of string-matching messages. */
export class ApiError extends Error {
  readonly status: number
  readonly payload: Record<string, unknown>

  constructor(message: string, status: number, payload: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

/** True when the server returned the Workstream C subscription lock (HTTP 402). */
export function isSubscriptionLocked(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 402
}

interface RequestOptions {
  method?: Method
  body?: unknown
  token?: string | null
  timeoutMs?: number
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-App': 'mobile',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.')
    }
    throw new Error('Network error. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {}

  if (!res.ok) {
    const payload = data as Record<string, unknown>
    const message =
      (typeof payload.message === 'string' && payload.message) ||
      (typeof payload.error === 'string' && payload.error) ||
      `Request failed (${res.status})`
    throw new ApiError(message, res.status, payload)
  }

  if (!contentType.includes('application/json')) {
    throw new Error('Unexpected server response. Try again in a moment.')
  }

  return data as T
}

/** Fetch a non-JSON (e.g. text/html) endpoint with auth. Used for print-ready receipt HTML. */
export async function apiFetchText(
  path: string,
  { token, timeoutMs = DEFAULT_TIMEOUT_MS }: { token?: string | null; timeoutMs?: number } = {},
): Promise<string> {
  const headers: Record<string, string> = { Accept: 'text/html', 'X-App': 'mobile' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.')
    }
    throw new Error('Network error. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status})`, res.status)
  }
  return res.text()
}
