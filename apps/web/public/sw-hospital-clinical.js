/* Clinical privacy boundary: authenticated HTML/JSON must never enter CacheStorage. */
const PREFIX = 'synapse-hospital-clinical-'
const ASSETS = PREFIX + 'assets-v4'
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== ASSETS)
      .map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSETS)
      const hit = await cache.match(request)
      if (hit) return hit
      const response = await fetch(request)
      if (response.ok && !response.redirected &&
          /^(text\/css|(?:text|application)\/javascript|font\/|application\/font-woff)/i.test(response.headers.get('content-type') || '') &&
          !/private|no-store/i.test(response.headers.get('cache-control') || '')) {
        try { await cache.put(request, response.clone()) } catch { /* quota: return network response */ }
      }
      return response
    })())
    return
  }
  const clinicalApi = /^\/api\/opd\/encounters\/[^/]+\/write-up\/?$/.test(url.pathname) ||
    url.pathname === '/api/hospital/sync/context'
  const notes = request.mode === 'navigate' &&
    (/^\/encounter\/[^/]+\/notes\/?$/.test(url.pathname) || /^\/doctor\/notes\/?$/.test(url.pathname))
  if (clinicalApi || notes) {
    event.respondWith((async () => {
      try { return await fetch(request, { cache: 'no-store' }) } catch {
        // Never fall back to a prior user's response, even if legacy caches
        // remain. Existing encrypted drafts and outbox are left untouched.
        return new Response(clinicalApi
          ? JSON.stringify({ error: 'OFFLINE_REAUTH_REQUIRED' })
          : 'Offline — reconnect to reopen clinical notes. Pending encrypted drafts have not been deleted.',
        { status: 503, headers: {
          'Content-Type': clinicalApi ? 'application/json' : 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        } })
      }
    })())
  }
})
