import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const root = new URL('../', import.meta.url)
const source = readFileSync(new URL('apps/web/public/sw-hospital-clinical.js', root), 'utf8')
const origin = 'https://clinical.example.test'
const writeupUrl = `${origin}/api/opd/encounters/synthetic/write-up`
const notesUrl = `${origin}/encounter/synthetic/notes`
const assetUrl = `${origin}/_next/static/chunks/example.js`
const secret = 'SYNTHETIC_NOTE_AND_RECOVERY_MATERIAL'

function harness() {
  const handlers = new Map()
  const stores = new Map()
  const calls = []
  let network = async () => new Response(secret, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  })
  const key = (request) => typeof request === 'string' ? request : request.url
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)
      return {
        put: async (request, response) => store.set(key(request), response.clone()),
        match: async (request) => store.get(key(request))?.clone(),
      }
    },
    match: async (request) => {
      for (const store of stores.values()) {
        if (store.has(key(request))) return store.get(key(request)).clone()
      }
    },
  }
  runInNewContext(source, {
    URL, Response, caches,
    fetch: async (...args) => { calls.push(args); return network(...args) },
    self: {
      location: { origin },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
  })
  return {
    stores, caches, calls,
    network: (fn) => { network = fn },
    activate: () => new Promise((resolve, reject) => {
      handlers.get('activate')({ waitUntil: (promise) => promise.then(resolve, reject) })
    }),
    request: (url, overrides = {}) => {
      let result
      handlers.get('fetch')({
        request: { url, method: 'GET', mode: 'cors', ...overrides },
        respondWith: (promise) => { result = promise },
      })
      return result
    },
  }
}

test('both deployment worker copies are identical', () => {
  assert.equal(readFileSync(new URL('public/sw-hospital-clinical.js', root), 'utf8'), source)
})

test('activation purges legacy clinical caches without deleting other app caches', async () => {
  const h = harness()
  for (const name of ['synapse-hospital-clinical-api-v3', 'synapse-hospital-clinical-shell-v3', 'synapse-hospital-clinical-assets-v3', 'pharmacy-offline', 'synapse-hospital-clinical-assets-v4']) {
    await h.caches.open(name)
  }
  await h.activate()
  assert.deepEqual([...h.stores.keys()].sort(), ['pharmacy-offline', 'synapse-hospital-clinical-assets-v4'])
})

for (const [label, url, mode] of [
  ['write-up including recovery material', writeupUrl, 'cors'],
  ['sync identity and recovery material', `${origin}/api/hospital/sync/context`, 'cors'],
  ['personalized clinical HTML', notesUrl, 'navigate'],
]) {
  test(`${label} is never persisted`, async () => {
    const h = harness()
    const response = await h.request(url, { mode })
    assert.equal(await response.text(), secret)
    assert.equal(h.calls[0][1].cache, 'no-store')
    assert.equal(h.stores.size, 0)
  })
}

test('offline account switch cannot replay previous user API or HTML from any cache', async () => {
  const h = harness()
  const oldCache = await h.caches.open('synapse-hospital-clinical-api-v3')
  await oldCache.put(writeupUrl, new Response(secret))
  await oldCache.put(notesUrl, new Response(secret))
  // Deliberately leave legacy entries present: the fetch boundary must not
  // depend on activation/logout cleanup having completed successfully.
  h.network(async () => { throw new TypeError('offline') })
  for (const [url, mode] of [[writeupUrl, 'cors'], [notesUrl, 'navigate']]) {
    const response = await h.request(url, { mode })
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.ok(!(await response.text()).includes(secret))
  }
})

test('auth rejection is returned unchanged, never replaced by cached clinical data', async () => {
  const h = harness()
  h.network(async () => new Response('unauthorized', { status: 401 }))
  assert.equal((await h.request(writeupUrl)).status, 401)
  assert.equal(h.stores.size, 0)
})

test('same-origin public build assets remain available offline', async () => {
  const h = harness()
  h.network(async () => new Response('/* public build asset */', { headers: { 'Content-Type': 'application/javascript' } }))
  await h.request(assetUrl)
  h.network(async () => { throw new TypeError('offline') })
  assert.equal(await (await h.request(assetUrl)).text(), '/* public build asset */')
  assert.equal(h.calls.length, 1)
})

test('HTML, private, no-store, redirected, and error responses at asset URLs are not cached', async () => {
  for (const response of [
    new Response(secret, { headers: { 'Content-Type': 'text/html' } }),
    new Response(secret, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'private' } }),
    new Response(secret, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' } }),
    new Response(secret),
    new Response(secret, { status: 500, headers: { 'Content-Type': 'application/javascript' } }),
  ]) {
    const h = harness()
    h.network(async () => response)
    await h.request(assetUrl)
    assert.equal(await h.caches.match(assetUrl), undefined)
  }
  const h = harness()
  const redirected = new Response(secret, { headers: { 'Content-Type': 'application/javascript' } })
  Object.defineProperty(redirected, 'redirected', { value: true })
  h.network(async () => redirected)
  await h.request(assetUrl)
  assert.equal(await h.caches.match(assetUrl), undefined)
})

test('cross-origin requests and mutations are not intercepted', () => {
  const h = harness()
  assert.equal(h.request('https://other.example.test/api/opd/encounters/x/write-up'), undefined)
  assert.equal(h.request(writeupUrl, { method: 'PUT' }), undefined)
  assert.equal(h.request(`${origin}/api/hospital/sync/apply`, { method: 'POST' }), undefined)
})

