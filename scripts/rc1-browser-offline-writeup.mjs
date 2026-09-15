import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const BASE = 'http://127.0.0.1:3011'
const ENC = 'c3333333-3333-4333-8333-333333333302'
const OUT = 'docs/engineering/evidence/browser-2026-09-13'
mkdirSync(OUT, { recursive: true })
const log = []
const step = (n, ok, d='') => { const l=`${ok?'PASS':'FAIL'} ${n}${d?' — '+d:''}`; log.push(l); console.log(l) }

const browser = await chromium.launch({ headless: true })
const token = readFileSync('/tmp/synapse-rc1-session-doctor.jwt', 'utf8').trim()
const context = await browser.newContext()
await context.addCookies([
  { name: 'synapse_session', value: token, domain: '127.0.0.1', path: '/', sameSite: 'Lax' },
  { name: 'synapse_session', value: token, domain: 'localhost', path: '/', sameSite: 'Lax' },
])
const page = await context.newPage()

await page.goto(`${BASE}/encounter/${ENC}/notes`, { waitUntil: 'networkidle' })
await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return
  const regs = await navigator.serviceWorker.getRegistrations()
  for (const r of regs) await r.update()
  const keys = await caches.keys()
  // Drop v1 shells so network-first v2 can populate
  await Promise.all(keys.filter((k) => k.includes('shell-v1') || k.includes('api-v1')).map((k) => caches.delete(k)))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => {
  const t = document.querySelector('main')?.textContent || ''
  return /Clinical write-up/i.test(t) && !/Loading clinical write-up/i.test(t)
}, { timeout: 20000 })
// Warm SW asset cache: ensure controller + second pass so /_next/static chunks are stored.
await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return
  await navigator.serviceWorker.register('/sw-hospital-clinical.js')
  await navigator.serviceWorker.ready
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForFunction(() => {
  const t = document.querySelector('main')?.textContent || ''
  return /Clinical write-up/i.test(t) && !/Loading clinical write-up/i.test(t)
}, { timeout: 20000 })
const assetCacheCount = await page.evaluate(async () => {
  const keys = await caches.keys()
  const assetKey = keys.find((k) => k.includes('assets'))
  if (!assetKey) return 0
  const cache = await caches.open(assetKey)
  return (await cache.keys()).length
})
step('SW cached next static assets', assetCacheCount > 0, `assets=${assetCacheCount}`)
await page.screenshot({ path: `${OUT}/10-offline-notes-online.png`, fullPage: true })
step('notes page online', /Clinical write-up/i.test(await page.textContent('main') || '') && !/Loading clinical write-up/i.test(await page.textContent('main') || ''))

await page.context().setOffline(true)
const stamp = `Browser offline HPI ${Date.now()}`
await page.locator('textarea').first().fill(stamp)
const clicked = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')]
  const b = buttons.find((x) => /save|queue/i.test(x.textContent || ''))
  if (!b) return false
  b.click()
  return true
})
step('clicked save while offline', clicked)
await page.waitForTimeout(1000)
const mid = await page.textContent('main')
step('offline save shows queued/not server-saved', /queued|not server-saved|pending offline/i.test(mid || ''), (mid || '').slice(0, 220))
await page.screenshot({ path: `${OUT}/11-offline-queued.png`, fullPage: true })

const storageOffline = await page.evaluate(() => {
  const ls = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k) ls[k] = localStorage.getItem(k)
  }
  const ss = {}
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)
    if (k) ss[k] = sessionStorage.getItem(k)
  }
  return { ls, ss }
})
const outboxKeys = Object.keys(storageOffline.ls).filter((k) => k.includes('hospital.clinical.outbox'))
const sessionKey = Object.keys(storageOffline.ss).find((k) => k.includes('sessionKey'))
step('encrypted outbox persisted in localStorage', outboxKeys.length >= 1, outboxKeys.join(','))
if (outboxKeys[0]) {
  const bucket = JSON.parse(storageOffline.ls[outboxKeys[0]])
  const rec = Object.values(bucket.records || {})[0]
  step('outbox payload encrypted (no plaintext HPI)', !!(rec?.encryptedCommand) && !JSON.stringify(bucket).includes(stamp), rec?.encryptedCommand?.slice(0, 24))
  step('outbox scoped to tenant+actor key', outboxKeys[0].includes('94ec9fd8') && outboxKeys[0].includes('389ee4bb'), outboxKeys[0])
}
step('session crypto key in sessionStorage while active', !!sessionKey)

// Real disconnected reload (service worker + encrypted draft snapshot).
// Wait for SW control then reload while still offline.
await page.waitForTimeout(500)
const swReady = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return false
  const reg = await navigator.serviceWorker.getRegistration()
  return Boolean(reg)
})
const preReload = await page.evaluate(() => ({
  identitySession: sessionStorage.getItem('synapse.hospital.clinical.identity.v1'),
  identityLocal: localStorage.getItem('synapse.hospital.clinical.identity.v1'),
  sessionKey: !!sessionStorage.getItem('synapse.hospital.clinical.sessionKey.v1'),
  draftKeys: Object.keys(localStorage).filter((k) => k.includes('writeup-draft')),
  online: navigator.onLine,
}))
step('pre-reload identity+draft present', !!(preReload.identitySession || preReload.identityLocal) && preReload.draftKeys.length > 0 && preReload.sessionKey, JSON.stringify(preReload).slice(0, 240))
step('service worker registered for offline shell', swReady)
let reloadOk = false
let reloadText = ''
try {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.waitForFunction(() => {
    const t = document.querySelector('main')?.textContent || ''
    return t && !/^\s*Loading clinical write-up/i.test(t)
  }, { timeout: 15000 }).catch(() => null)
  await page.waitForTimeout(500)
  reloadText = (await page.textContent('main')) || ''
  const stillLoading = /^\s*Loading clinical write-up/i.test(reloadText)
  reloadOk = !stillLoading && /Clinical write-up|Showing last local draft|Queued offline|pending offline|write-up unavailable|Failed to load/i.test(reloadText)
  step('real offline reload leaves loading state', reloadOk, reloadText.slice(0, 220))
  step('offline reload keeps queued stamp visible', reloadText.includes(stamp), reloadText.slice(0, 180))
} catch (err) {
  step('real offline reload leaves loading state', false, String(err).slice(0, 200))
  step('offline reload keeps queued stamp visible', false, 'reload threw')
}
await page.screenshot({ path: `${OUT}/12-offline-reload.png`, fullPage: true })

// Account switch surrogate: other actor key absent
const otherActorLeak = Object.keys(storageOffline.ls).some((k) => k.includes('hospital.clinical') && k.includes('a1111111'))
step('no other-actor outbox keys visible', !otherActorLeak)

await page.context().setOffline(false)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')]
  const b = buttons.find((x) => /sync|flush|retry|save/i.test(x.textContent || ''))
  if (b) b.click()
})
await page.waitForTimeout(2000)
await page.screenshot({ path: `${OUT}/13-offline-reconnected.png`, fullPage: true })
const online = await page.textContent('main')
step('reconnect UI still usable', /write-up|HPI|Clinical/i.test(online || ''), (online || '').slice(0, 180))

// Logout park
await context.clearCookies()
await context.addCookies([
  { name: 'synapse_session', value: token, domain: '127.0.0.1', path: '/', sameSite: 'Lax' },
  { name: 'synapse_session', value: token, domain: 'localhost', path: '/', sameSite: 'Lax' },
])
await page.goto(`${BASE}/lab/orders`, { waitUntil: 'networkidle' })
const hasSignOut = await page.getByRole('button', { name: /Sign out/i }).count()
step('lab sign out control present', hasSignOut > 0)
if (hasSignOut) {
  // Ensure some outbox exists then sign out
  await page.evaluate(() => {
    localStorage.setItem('synapse.hospital.clinical.outbox.v2:94ec9fd8-17ac-4f40-8f82-429d44cb8b02:389ee4bb-4708-4f83-af6f-58c3c4253b9c', JSON.stringify({
      version: 2,
      records: { '00000000-0000-4000-8000-000000000099': {
        commandId: '00000000-0000-4000-8000-000000000099',
        tenantId: '94ec9fd8-17ac-4f40-8f82-429d44cb8b02',
        actorId: '389ee4bb-4708-4f83-af6f-58c3c4253b9c',
        commandType: 'clinical.encounter.writeup.v1',
        status: 'queued',
        attemptCount: 0,
        lastError: null,
        serverAckId: null,
        appliedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checkpoint: null,
        encryptedCommand: 'dGVzdA==',
        iv: 'dGVzdGl2MTIy',
      } },
      checkpoints: {},
    }))
    sessionStorage.setItem('synapse.hospital.clinical.sessionKey.v1', btoa('12345678901234567890123456789012'))
    sessionStorage.setItem('synapse.hospital.clinical.wrapMaterial.v1', btoa('wrap-material-actor-a-32-bytes!!'))
  })
  await page.getByRole('button', { name: /Sign out/i }).click()
  await page.waitForTimeout(1000)
  const after = await page.evaluate(() => ({
    ls: Object.keys(localStorage),
    ss: Object.keys(sessionStorage),
    parked: localStorage.getItem('synapse.hospital.clinical.parked.v2:94ec9fd8-17ac-4f40-8f82-429d44cb8b02:389ee4bb-4708-4f83-af6f-58c3c4253b9c'),
    live: localStorage.getItem('synapse.hospital.clinical.outbox.v2:94ec9fd8-17ac-4f40-8f82-429d44cb8b02:389ee4bb-4708-4f83-af6f-58c3c4253b9c'),
    key: sessionStorage.getItem('synapse.hospital.clinical.sessionKey.v1'),
  }))
  step('logout parks pending outbox', !!after.parked && !after.live, `parked=${!!after.parked} live=${!!after.live}`)
  step('logout clears live session key', !after.key)
  if (after.parked) {
    const park = JSON.parse(after.parked)
    step('park has no raw keyMaterial', park.keyMaterial == null)
    step('park has wrap ciphertext for restore', typeof park.wrap === 'string' && typeof park.wrapIv === 'string')
  }
  await page.screenshot({ path: `${OUT}/14-after-logout-park.png`, fullPage: true })
}

await browser.close()
writeFileSync(`${OUT}/offline-browser-log.txt`, log.join('\n') + '\n')
const failed = log.filter((l) => l.startsWith('FAIL')).length
console.log(`\nOffline summary: ${log.length - failed} PASS, ${failed} FAIL`)
process.exit(failed ? 1 : 0)
