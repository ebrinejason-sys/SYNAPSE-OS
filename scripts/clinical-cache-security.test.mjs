import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import yaml from 'js-yaml'

const root = new URL('../', import.meta.url)
const worker = readFileSync(new URL('apps/web/public/sw-hospital-clinical.js', root), 'utf8')
function harness() {
  const handlers = new Map()
  const deleted = []
  const stored = new Map()
  let network = async () => new Response('synthetic clinical data and recovery key', { headers: { 'Content-Type': 'application/json' } })
  const cache = {
    match: async (r) => stored.get(r.url)?.clone(),
    put: async (r, response) => stored.set(r.url, response.clone()),
  }
  runInNewContext(worker, {
    URL, Response,
    fetch: (...args) => network(...args),
    caches: {
      keys: async () => ['synapse-hospital-clinical-api-v3', 'synapse-hospital-clinical-shell-v3', 'pharmacy-cache'],
      delete: async (key) => deleted.push(key),
      open: async () => cache,
      match: async () => new Response('previous-user-secret'),
    },
    self: {
      location: { origin: 'https://fixture.test' },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: async () => {}, clients: { claim: async () => {} },
    },
  })
  return {
    stored, deleted,
    network: (fn) => { network = fn },
    activate: () => { let work; handlers.get('activate')({ waitUntil: (p) => { work = p } }); return work },
    request: (path, mode = 'cors') => {
      let work
      handlers.get('fetch')({ request: { url: `https://fixture.test${path}`, mode, method: 'GET' }, respondWith: (p) => { work = p } })
      return work
    },
  }
}

test('served worker copies match', () => {
  assert.equal(worker, readFileSync(new URL('public/sw-hospital-clinical.js', root), 'utf8'))
})
test('activation deletes only legacy caches owned by the clinical worker', async () => {
  const h = harness()
  await h.activate()
  assert.deepEqual(h.deleted, ['synapse-hospital-clinical-api-v3', 'synapse-hospital-clinical-shell-v3'])
})
test('clinical JSON, recovery context, and authenticated HTML are never cached', async () => {
  const h = harness()
  for (const [path, mode] of [['/api/opd/encounters/x/write-up', 'cors'], ['/api/hospital/sync/context', 'cors'], ['/encounter/x/notes', 'navigate']]) {
    assert.equal((await h.request(path, mode)).status, 200)
  }
  assert.equal(h.stored.size, 0)
})
test('offline clinical requests cannot replay a previous user cache', async () => {
  const h = harness()
  h.network(async () => { throw new TypeError('offline') })
  for (const [path, mode] of [['/api/opd/encounters/x/write-up', 'cors'], ['/api/hospital/sync/context', 'cors'], ['/encounter/x/notes', 'navigate']]) {
    const response = await h.request(path, mode)
    assert.equal(response.status, 503)
    assert.ok(!(await response.text()).includes('previous-user-secret'))
  }
})
test('public assets stay available without caching private or HTML responses', async () => {
  const h = harness()
  h.network(async () => new Response('public script', { headers: { 'Content-Type': 'application/javascript' } }))
  await h.request('/_next/static/public.js')
  h.network(async () => { throw new TypeError('offline') })
  assert.equal(await (await h.request('/_next/static/public.js')).text(), 'public script')
  for (const headers of [{ 'Content-Type': 'text/html' }, { 'Content-Type': 'application/javascript', 'Cache-Control': 'private, no-store' }]) {
    h.network(async () => new Response('private', { headers }))
    await h.request('/_next/static/private.js')
    assert.equal(h.stored.has('https://fixture.test/_next/static/private.js'), false)
  }
})
test('CI clinical test commands are separate shell commands, not folded arguments', () => {
  const ci = yaml.load(readFileSync(new URL('.github/workflows/ci.yml', root), 'utf8'))
  const step = ci.jobs.verify.steps.find((s) => s.name === 'Encounter close-gate tests')
  const commands = step.run.trim().split('\n')
  assert.equal(commands.length, 11)
  for (const command of commands) assert.match(command.trim(), /^npm run test:[a-z-]+$/)
})
