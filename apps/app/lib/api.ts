import Constants from 'expo-constants'

const BASE_URL = (
  (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ?? 'https://synapseos.tech'
).replace(/\/$/, '')

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

interface RequestOptions {
  method?: Method
  body?: unknown
  token?: string | null
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App': 'mobile',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error((data as { error?: string })?.error ?? `Request failed (${res.status})`)
  }

  return data as T
}
