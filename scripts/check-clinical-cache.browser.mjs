// Browser cache-boundary regression only, NOT clinical/auth/DB acceptance.
// Uses a fresh browser context and an ephemeral loopback fixture server.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { chromium } from 'playwright'

const worker = readFileSync(new URL('../apps/web/public/sw-hospital-clinical.js', import.meta.url), 'utf8')
const sensitive = 'SYNTHETIC_PRIVATE_NOTE_AND_WRAP'
const apiPath = '/api/opd/encounters/synthetic/write-up'
const notesPath = '/encounter/synthetic/notes'
const assetPath = '/_next/static/cache-check.js'
let disconnected = false
const server = createServer((req, res) => {
  // Also cut fixture sockets: Chromium's page offline emulation may leave
  // service-worker network requests online. Keep the failure assertion strict.
  if (disconnected) return req.socket.destroy()
  res.setHeader('Cache-Control', 'no-store')
  if (req.url === '/sw-hospital-clinical.js') {
    res.setHeader('Content-Type', 'application/javascript')
    return res.end(worker)
  }
  if (req.url === apiPath) {
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ clinicalNote: sensitive, syncContext: { outboxWrapMaterial: sensitive } }))
  }
  if (req.url === assetPath) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('Content-Type', 'application/javascript')
    return res.end('/* public synthetic asset */')
  }
  res.setHeader('Content-Type', 'text/html')
  res.end(`<!doctype html><title>Cache boundary fixture</title><main>${req.url === notesPath ? sensitive : 'Synthetic fixture only'}</main>`)
})
let browser
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  const page = await context.newPage()
  await page.goto(origin)
  await page.evaluate(async ({ apiPath, sensitive }) => {
    const legacy = await caches.open('synapse-hospital-clinical-api-v3')
    await legacy.put(apiPath, new Response(sensitive))
    await caches.open('unrelated-app-cache')
    await navigator.serviceWorker.register('/sw-hospital-clinical.js')
    await navigator.serviceWorker.ready
  }, { apiPath, sensitive })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  const names = await page.evaluate(() => caches.keys())
  assert.ok(!names.includes('synapse-hospital-clinical-api-v3'), 'legacy plaintext cache must be purged')
  assert.ok(names.includes('unrelated-app-cache'), 'other app caches must survive')

  const onlineBody = await page.evaluate(async (path) => (await fetch(path)).text(), apiPath)
  assert.ok(onlineBody.includes(sensitive), 'fixture must exercise a sensitive online response')
  await page.goto(origin + notesPath)
  assert.ok((await page.textContent('main')).includes(sensitive))
  await page.evaluate(async (path) => (await fetch(path)).text(), assetPath)
  const cachedUrls = await page.evaluate(async () => {
    const urls = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      urls.push(...(await cache.keys()).map((request) => request.url))
    }
    return urls
  })
  assert.ok(cachedUrls.some((url) => url.endsWith(assetPath)))
  assert.ok(!cachedUrls.some((url) => url.endsWith(apiPath) || url.endsWith(notesPath)), 'clinical responses must not enter CacheStorage')

  disconnected = true
  await context.setOffline(true)
  const offline = await page.evaluate(async (path) => {
    const response = await fetch(path)
    return { status: response.status, body: await response.text() }
  }, apiPath)
  assert.equal(offline.status, 503)
  assert.ok(!offline.body.includes(sensitive))
  const navigation = await page.reload()
  assert.equal(navigation.status(), 503)
  assert.match(await page.textContent('body'), /reconnect/i)
  assert.ok(!(await page.textContent('body')).includes(sensitive))
  assert.equal(await page.evaluate(async (path) => (await fetch(path)).text(), assetPath), '/* public synthetic asset */')

  disconnected = false
  await context.setOffline(false)
  await page.reload()
  assert.ok((await page.textContent('main')).includes(sensitive), 'online reconnect must still work')
  console.log('PASS: Chromium cache purge, clinical non-persistence, offline denial, public assets, and reconnect (synthetic fixture only).')
} finally {
  if (browser) await browser.close()
  await new Promise((resolve) => server.close(resolve))
}

