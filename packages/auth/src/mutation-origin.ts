/**
 * Cookie-authenticated mutation origin check.
 *
 * Session cookies are SameSite=Lax, so a cross-site form POST does not attach
 * them. Sibling hosts (admin.synapseos.tech, pharm.synapseos.tech) are
 * same-site, and Lax attaches even host-only cookies to same-site requests,
 * so SameSite alone does not stop a sibling host. This check rejects a present
 * Origin or Referer whose host is not the request host.
 *
 * Requests carrying no auth cookie are left alone (public pre-auth endpoints).
 * Non-browser clients that send neither Origin nor Referer are allowed.
 */

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Staff, customer, MFA and Supabase auth cookies all authenticate a mutation. */
export function hasAuthCookie(names: Iterable<string>): boolean {
  for (const name of names) {
    if (name.startsWith('synapse_') || name.startsWith('sb-')) return true
  }
  return false
}

export type MutationOriginInput = {
  method: string
  host: string | null
  origin: string | null
  referer: string | null
  secFetchSite: string | null
  hasSessionCookie: boolean
}

export type MutationOriginDecision = {
  allow: boolean
  reason: 'safe_method' | 'no_cookie' | 'same_host' | 'no_browser_metadata' | 'cross_origin' | 'cross_site' | 'bad_host'
}

function hostnameOf(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return null
  }
}

function requestHostname(host: string | null): string | null {
  if (!host) return null
  return host.split(',')[0]?.trim().split(':')[0]?.toLowerCase() || null
}

export function decideMutationOrigin(input: MutationOriginInput): MutationOriginDecision {
  if (!UNSAFE.has(input.method.toUpperCase())) return { allow: true, reason: 'safe_method' }
  if (!input.hasSessionCookie) return { allow: true, reason: 'no_cookie' }
  const host = requestHostname(input.host)
  if (!host) return { allow: false, reason: 'bad_host' }

  const originHost = hostnameOf(input.origin)
  if (input.origin) {
    return originHost === host
      ? { allow: true, reason: 'same_host' }
      : { allow: false, reason: 'cross_origin' }
  }

  const refererHost = hostnameOf(input.referer)
  if (refererHost && refererHost !== host) return { allow: false, reason: 'cross_origin' }

  const site = (input.secFetchSite ?? '').toLowerCase()
  if (site === 'cross-site' || site === 'same-site') return { allow: false, reason: 'cross_site' }

  return { allow: true, reason: 'no_browser_metadata' }
}
