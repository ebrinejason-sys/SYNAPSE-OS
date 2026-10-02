/**
 * Canonical base URL for every link the Pharmacy app puts in an email or redirect.
 *
 * Pharmacy emails used NEXT_PUBLIC_APP_URL, which in production is the OS apex;
 * `https://synapseos.tech/reset-password/<token>` 307s to www and 404s. Always use
 * NEXT_PUBLIC_PHARMACY_APP_URL, falling back to the pharm host, never the apex.
 */
export const PHARMACY_APP_URL_FALLBACK = "https://pharm.synapseos.tech"

const APEX_HOSTS = new Set(["synapseos.tech", "www.synapseos.tech"])

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1"
}

export function pharmacyAppUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_PHARMACY_APP_URL ?? "").trim()
  if (!raw) return PHARMACY_APP_URL_FALLBACK
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return PHARMACY_APP_URL_FALLBACK
  }
  const local = isLocalHost(url.hostname)
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return PHARMACY_APP_URL_FALLBACK
  if (APEX_HOSTS.has(url.hostname.toLowerCase())) return PHARMACY_APP_URL_FALLBACK
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`
}

export function pharmacyUrl(path: string): string {
  return `${pharmacyAppUrl()}/${path.replace(/^\/+/, "")}`
}
