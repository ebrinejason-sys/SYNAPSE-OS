/* SYNAPSE RC1 hospital clinical offline shell — same-origin only */
const SHELL = 'synapse-hospital-clinical-shell-v3'
const API = 'synapse-hospital-clinical-api-v3'
const ASSETS = 'synapse-hospital-clinical-assets-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, API, ASSETS])
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

function isNotesNav(request) {
  if (request.mode !== 'navigate') return false
  try {
    const u = new URL(request.url)
    return /\/encounter\/[^/]+\/notes/.test(u.pathname) || /\/doctor\/notes/.test(u.pathname)
  } catch {
    return false
  }
}

function isWriteupGet(request) {
  if (request.method !== 'GET') return false
  try {
    const u = new URL(request.url)
    return /\/api\/opd\/encounters\/[^/]+\/write-up$/.test(u.pathname)
  } catch {
    return false
  }
}

function isNextAsset(request) {
  if (request.method !== 'GET') return false
  try {
    const u = new URL(request.url)
    return u.origin === self.location.origin && u.pathname.startsWith('/_next/static/')
  } catch {
    return false
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (isNextAsset(request)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        try {
          const res = await fetch(request)
          if (res.ok) cache.put(request, res.clone())
          return res
        } catch (err) {
          if (hit) return hit
          throw err
        }
      }),
    )
    return
  }

  if (isWriteupGet(request)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(API).then((c) => c.put(request, clone))
          }
          return res
        })
        .catch(async () => {
          const hit = await caches.match(request)
          if (hit) return hit
          return new Response(JSON.stringify({ error: 'OFFLINE_NO_CACHE' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }),
    )
    return
  }

  if (isNotesNav(request)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(SHELL).then((c) => c.put(request, clone))
          }
          return res
        })
        .catch(async () => {
          const hit = await caches.match(request)
          if (hit) return hit
          return new Response('Offline — open notes once online to cache the shell.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }),
    )
  }
})
