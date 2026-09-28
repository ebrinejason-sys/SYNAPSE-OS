import { describe, expect, it } from 'vitest'
import { decideMutationOrigin } from './mutation-origin'

const cookie = { hasSessionCookie: true }

describe('mutation origin', () => {
  it('allows same-host JSON and form posts, and safe methods', () => {
    expect(decideMutationOrigin({ method: 'GET', host: 'admin.synapseos.tech', origin: 'https://evil.test', referer: null, secFetchSite: 'cross-site', ...cookie }).allow).toBe(true)
    expect(decideMutationOrigin({ method: 'POST', host: 'admin.synapseos.tech', origin: 'https://admin.synapseos.tech', referer: null, secFetchSite: 'same-origin', ...cookie })).toMatchObject({ allow: true, reason: 'same_host' })
    expect(decideMutationOrigin({ method: 'POST', host: 'localhost:3001', origin: 'http://localhost:3001', referer: null, secFetchSite: 'same-origin', ...cookie }).allow).toBe(true)
  })

  it('rejects cross-site form and JSON origins when a session cookie is present', () => {
    const form = decideMutationOrigin({ method: 'POST', host: 'admin.synapseos.tech', origin: 'https://evil.test', referer: 'https://evil.test/trap', secFetchSite: 'cross-site', ...cookie })
    const json = decideMutationOrigin({ method: 'POST', host: 'admin.synapseos.tech', origin: 'https://evil.test', referer: null, secFetchSite: 'cross-site', ...cookie })
    expect(form).toMatchObject({ allow: false, reason: 'cross_origin' })
    expect(json).toMatchObject({ allow: false, reason: 'cross_origin' })
  })

  it('rejects a sibling subdomain even though it is same-site', () => {
    const sibling = decideMutationOrigin({
      method: 'POST',
      host: 'admin.synapseos.tech',
      origin: 'https://pharm.synapseos.tech',
      referer: 'https://pharm.synapseos.tech/portal/pos',
      secFetchSite: 'same-site',
      ...cookie,
    })
    expect(sibling).toMatchObject({ allow: false, reason: 'cross_origin' })
  })

  it('does not block public pre-auth posts or non-browser clients', () => {
    expect(decideMutationOrigin({ method: 'POST', host: 'admin.synapseos.tech', origin: 'https://evil.test', referer: null, secFetchSite: 'cross-site', hasSessionCookie: false }).allow).toBe(true)
    expect(decideMutationOrigin({ method: 'POST', host: 'admin.synapseos.tech', origin: null, referer: null, secFetchSite: null, ...cookie })).toMatchObject({ allow: true, reason: 'no_browser_metadata' })
  })
})
