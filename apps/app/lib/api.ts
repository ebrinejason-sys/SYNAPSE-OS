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

const DEFAULT_TIMEOUT_MS = 45_000

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

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
    throw new Error((data as { error?: string })?.error ?? `Request failed (${res.status})`)
  }

  if (!contentType.includes('application/json')) {
    throw new Error('Unexpected server response. Try again in a moment.')
  }

  return data as T
}
