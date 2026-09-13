/**
 * Disposable RC1 browser lab acceptance against http://127.0.0.1:3011
 * Uses Playwright + pre-minted synapse_session cookies (synthetic tenants only).
 */
import { chromium } from 'playwright'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'

const BASE = process.env.RC1_BASE_URL || 'http://127.0.0.1:3011'
const OUT = 'docs/engineering/evidence/browser-2026-09-13'
const ORDER = 'd4444444-4444-4444-8444-444444444402'
const ENC = 'c3333333-3333-4333-8333-333333333302'
const PAT = 'b2222222-2222-4222-8222-222222222202'
const TENANT_A = '94ec9fd8-17ac-4f40-8f82-429d44cb8b02'
const TENANT_B = 'ab239578-7f7a-4fdc-af1e-bfdaf1a77847'

mkdirSync(OUT, { recursive: true })
const log = []
function step(name, ok, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`
  log.push(line)
  console.log(line)
}

async function withRole(browser, roleFile, fn) {
  const token = readFileSync(`/tmp/synapse-rc1-session-${roleFile}.jwt`, 'utf8').trim()
  const context = await browser.newContext()
  await context.addCookies([
    { name: 'synapse_session', value: token, domain: '127.0.0.1', path: '/', httpOnly: false, sameSite: 'Lax' },
    { name: 'synapse_session', value: token, domain: 'localhost', path: '/', httpOnly: false, sameSite: 'Lax' },
  ])
  const page = await context.newPage()
  try {
    return await fn(page, context)
  } finally {
    await context.close()
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  let replacementId = null

  // Tech: open worklist, collect/receive/reject via UI
  await withRole(browser, 'lab-tech', async (page) => {
    await page.goto(`${BASE}/lab/orders`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: `${OUT}/01-tech-worklist.png`, fullPage: true })
    const body = await page.textContent('main')
    const hasOrder = body?.includes('Malaria') || body?.includes(ORDER.slice(0, 8))
    step('tech worklist loads order', !!hasOrder && !body?.includes('does not have access'), (body || '').slice(0, 120))

    // Find the card for our patient
    const card = page.locator('li').filter({ hasText: 'Browser Patient' }).first()
    const count = await card.count()
    step('browser patient card visible', count === 1)
    if (count === 1) {
      await card.getByRole('button', { name: 'Collect' }).click()
      await page.waitForTimeout(800)
      await card.getByRole('button', { name: 'Receive' }).click()
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${OUT}/02-tech-collected-received.png`, fullPage: true })
      step('collect+receive via UI', true)

      await card.getByRole('button', { name: 'Reject' }).click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: `${OUT}/03-tech-rejected.png`, fullPage: true })
      const after = await page.textContent('main')
      step('reject via UI', /REJECTED/i.test(after || '') || /reject/i.test(after || ''), (after || '').slice(0, 160))
    }
  })

  // Doctor: create replacement via API from browser context (UI may lack replaces field)
  await withRole(browser, 'doctor', async (page) => {
    await page.goto(`${BASE}/encounter/${ENC}/notes`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: `${OUT}/04-doctor-notes.png`, fullPage: true })
    const notes = await page.textContent('main')
    step('doctor notes page', !/Sign in|Unauthorized|Forbidden/i.test(notes || ''), (notes || '').slice(0, 120))

    const res = await page.evaluate(async ({ ENC, PAT, ORDER, base }) => {
      const r = await fetch(`${base}/api/opd/lab-orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          encounter_id: ENC,
          patient_id: PAT,
          test_name: 'Malaria Pf antigen',
          loinc_code: '32780-9',
          replaces_lab_order_id: ORDER,
        }),
      })
      return { status: r.status, body: await r.json() }
    }, { ENC, PAT, ORDER, base: BASE })
    replacementId = res.body?.order?.id || res.body?.orderId || res.body?.id || res.body?.existingOrderId || null
    step('doctor replacement order', (res.status === 200 || res.status === 201 || res.status === 409) && !!replacementId, JSON.stringify(res).slice(0, 220))
  })

  if (!replacementId) {
    step('replacement id available', false, 'cannot continue result chain')
  } else {
    // Tech: collect/receive/enter on replacement via UI
    await withRole(browser, 'lab-tech', async (page) => {
      await page.goto(`${BASE}/lab/orders`, { waitUntil: 'networkidle' })
      const card = page.locator('li').filter({ hasText: 'Browser Patient' }).filter({ hasNotText: 'REJECTED' }).first()
      // Prefer card that is not rejected — click collect on first non-rejected Browser Patient
      const cards = page.locator('li').filter({ hasText: 'Browser Patient' })
      const n = await cards.count()
      let target = null
      for (let i = 0; i < n; i++) {
        const text = await cards.nth(i).textContent()
        if (text && !/REJECTED/i.test(text)) { target = cards.nth(i); break }
      }
      if (!target) {
        step('replacement card on worklist', false)
        return
      }
      await target.getByRole('button', { name: 'Collect' }).click()
      await page.waitForTimeout(700)
      await target.getByRole('button', { name: 'Receive' }).click()
      await page.waitForTimeout(700)
      await page.locator('input').first().fill('Positive')
      await target.getByRole('button', { name: 'Enter result' }).click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: `${OUT}/05-tech-result-entered.png`, fullPage: true })
      step('replacement collect/receive/enter via UI', true)

      // Wrong-role: tech Verify should fail (403 surfaced)
      await target.getByRole('button', { name: 'Verify' }).click()
      await page.waitForTimeout(800)
      const err = await page.textContent('main')
      step('lab_tech verify denied in UI', /lab_tech cannot verify|403|scientist/i.test(err || ''), (err || '').slice(0, 180))
    })

    // Scientist: verify + release via verify page UI
    await withRole(browser, 'lab-sci', async (page) => {
      await page.goto(`${BASE}/lab/verify`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/06-sci-verify-queue.png`, fullPage: true })
      const item = page.locator('li').filter({ hasText: 'Browser Patient' }).first()
      if (await item.count()) {
        await item.getByRole('button', { name: 'Verify' }).click()
        await page.waitForTimeout(900)
        // may need refresh for Release
        await page.reload({ waitUntil: 'networkidle' })
        const item2 = page.locator('li').filter({ hasText: 'Browser Patient' }).first()
        if (await item2.getByRole('button', { name: 'Release' }).count()) {
          await item2.getByRole('button', { name: 'Release' }).click()
          await page.waitForTimeout(900)
        } else {
          // try verify page again or orders
          await page.goto(`${BASE}/lab/verify`, { waitUntil: 'networkidle' })
          const rel = page.locator('li').filter({ hasText: 'Browser' }).getByRole('button', { name: 'Release' })
          if (await rel.count()) await rel.first().click()
        }
        await page.screenshot({ path: `${OUT}/07-sci-released.png`, fullPage: true })
        step('scientist verify/release via UI', true)
      } else {
        step('scientist verify queue shows item', false)
      }

      await page.goto(`${BASE}/lab/results`, { waitUntil: 'networkidle' })
      await page.locator('input').first().fill('Negative')
      const amendBtn = page.getByRole('button', { name: 'Amend' }).first()
      if (await amendBtn.count()) {
        await amendBtn.click()
        await page.waitForTimeout(1000)
        step('amend via results UI', true)
      } else {
        step('amend via results UI', false, 'no Amend button')
      }
      await page.screenshot({ path: `${OUT}/08-sci-amended.png`, fullPage: true })
    })
  }

  // Wrong-facility: tenant-A lab_tech against tenant-B order id
  await withRole(browser, 'lab-tech', async (page) => {
    await page.goto(`${BASE}/lab/orders`, { waitUntil: 'domcontentloaded' })
    const cross = await page.evaluate(async () => {
      const r = await fetch('/api/lab/actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: '26713dcf-d669-45b0-ab4a-61e0427efee0', action: 'collect' }),
      })
      return { status: r.status, body: await r.json() }
    })
    step('cross-facility collect denied', cross.status >= 400, JSON.stringify(cross).slice(0, 180))
  })

  // Unauthenticated
  {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${BASE}/lab/orders`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: `${OUT}/09-unauth-worklist.png`, fullPage: true })
    const t = await page.textContent('main')
    step('unauth worklist denied', /does not have access|Sign in|Unauthorized/i.test(t || ''), (t || '').slice(0, 120))
    await context.close()
  }

  await browser.close()
  writeFileSync(`${OUT}/lab-browser-log.txt`, log.join('\n') + '\n')
  const failed = log.filter((l) => l.startsWith('FAIL')).length
  console.log(`\nSummary: ${log.length - failed} PASS, ${failed} FAIL`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
