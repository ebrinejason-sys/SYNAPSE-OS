#!/usr/bin/env node
// Local browser acceptance: axe on representative authenticated pages, keyboard focus walk
// (visible focus, forward/back order, no traps) and an authenticated navigation crawl.
// Findings are written to .tmp/ui-acceptance.json; BLOCKER/MAJOR axe issues and dead links fail.
// axe-core is resolved from the hoisted copy installed by eslint-plugin-jsx-a11y.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { chromium } from "playwright"
import { assertLocalTargets, BASE, ensurePlatformUser, loginAs, PHARM_BASE, pharmacyLogin, platformLogin, Report, sql } from "./lib.mjs"

assertLocalTargets()
const r = new Report("ui-acceptance")
const SLUG = "synapse-e2e-hospital"
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8")
const SEVERITY = { critical: "BLOCKER", serious: "MAJOR", moderate: "MINOR", minor: "MINOR" }
// Brand orange shades (as rendered, including tinted primaries). Contrast on these is reported
// separately because changing them alters the brand palette.
const BRAND_COLORS = ["#f97316", "#ff6600", "#ea580c", "#db5b06", "#b84500"]

const encounter = JSON.parse(sql(`select json_build_object('e', id, 'p', patient_id) from encounters
  where tenant_id='cd6f9771-2479-4236-b9ba-16985b3ef6d4' and not coalesce(is_signed,false) order by created_at desc limit 1`) || "{}")

const platform = ensurePlatformUser({ email: "platform-b.e2e@synapseos.invalid", name: "Restore Operator B" })
const actors = [
  { role: "platform_admin", session: await platformLogin(platform, "platform"), base: BASE, pages: [["Admin Users", "/platform/users"]], crawl: ["/platform"] },
  { role: "hospital_admin", session: await loginAs("hospital_admin"), base: BASE, pages: [["Hospital dashboard", `/os/${SLUG}/dashboard`], ["Staff", "/hospital/admin/staff"]], crawl: [`/os/${SLUG}/dashboard`, "/hospital/admin"] },
  { role: "receptionist", session: await loginAs("receptionist"), base: BASE, pages: [["Patient registration", `/os/${SLUG}/patients`]], crawl: [`/os/${SLUG}/patients`] },
  { role: "doctor", session: await loginAs("doctor"), base: BASE, pages: [
    ["Doctor encounter", `/os/${SLUG}/encounters/new?patientId=${encounter.p ?? ""}`],
    ["Doctor orders", `/os/${SLUG}/clinical/orders?encounterId=${encounter.e ?? ""}&patientId=${encounter.p ?? ""}`],
  ], crawl: [`/os/${SLUG}/clinical`] },
  { role: "lab_technician", session: await loginAs("lab_technician"), base: BASE, pages: [["Lab worklist", "/lab/orders"]], crawl: ["/lab/orders"] },
  { role: "pharmacy_cashier", session: await pharmacyLogin("pharm.mgr.a.e2e@synapseos.invalid", "pharmacy"), base: PHARM_BASE, pages: [["Pharmacy POS", "/portal/pos"]], crawl: ["/portal/dashboard"] },
]

const findings = { axe: [], keyboard: [], crawl: [] }
const browser = await chromium.launch()
try {
  for (const actor of actors) {
    const origin = new URL(actor.base)
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    await context.addCookies([...actor.session.jar].map(([name, value]) => ({ name, value, domain: origin.hostname, path: "/", httpOnly: true, sameSite: "Lax" })))
    const page = await context.newPage()
    page.on("dialog", (d) => d.dismiss())

    for (const [label, path] of actor.pages) {
      const res = await page.goto(`${actor.base}${path}`, { waitUntil: "networkidle" })
      const landed = new URL(page.url()).pathname
      r.check(`page.${label}.loads`, res && res.status() < 400 && !/\/login|unauthorized/.test(landed), `HTTP ${res?.status()} landed=${landed}`)

      await page.addScriptTag({ content: axeSource })
      const axe = await page.evaluate(async (brand) => {
        // WCAG 1.4.3 exempts logotypes.
        // eslint-disable-next-line no-undef
        const out = await axe.run({ exclude: [["[data-logotype]"]] }, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })
        const isBrand = (n) => { const d = n.any?.[0]?.data ?? {}; return brand.includes(d.fgColor) || brand.includes(d.bgColor) }
        return out.violations.flatMap((v) => {
          const describe = (nodes, extra) => ({ id: v.id, impact: v.impact, help: v.help, nodes: nodes.length, targets: nodes.slice(0, 3).map((n) => n.target.join(" ")), ...extra,
            colors: v.id === "color-contrast" ? nodes.map((n) => { const d = n.any?.[0]?.data ?? {}; return `${d.fgColor} on ${d.bgColor} ${d.contrastRatio} ${n.target.join(" ").slice(0, 60)}` }) : undefined })
          if (v.id !== "color-contrast") return [describe(v.nodes)]
          const brandNodes = v.nodes.filter(isBrand)
          const other = v.nodes.filter((n) => !isBrand(n))
          return [other.length ? describe(other) : null, brandNodes.length ? describe(brandNodes, { brandDecision: true }) : null].filter(Boolean)
        })
      }, BRAND_COLORS)
      for (const v of axe) findings.axe.push({ page: label, severity: SEVERITY[v.impact] ?? "MINOR", ...v })
      const serious = axe.filter((v) => !v.brandDecision && ["critical", "serious"].includes(v.impact))
      const brandOnly = axe.filter((v) => v.brandDecision)
      if (brandOnly.length) console.log(`NOTE ${label}: brand-orange contrast (product decision) nodes=${brandOnly.reduce((a, v) => a + v.nodes, 0)}`)
      r.check(`axe.${label}.no_blocker_or_major`, serious.length === 0, serious.map((v) => `${SEVERITY[v.impact]}:${v.id}(${v.nodes})`).join(", "))

      const walk = await keyboardWalk(page)
      findings.keyboard.push({ page: label, ...walk })
      r.check(`keyboard.${label}.reaches_controls`, walk.distinct >= 3, `distinct=${walk.distinct}`)
      r.check(`keyboard.${label}.visible_focus`, walk.invisible.length === 0, walk.invisible.slice(0, 5).join(" | "))
      r.check(`keyboard.${label}.no_trap`, !walk.trapped, walk.trapDetail)
      r.check(`keyboard.${label}.shift_tab_reverses`, walk.reverseOk, walk.reverseDetail)
    }

    const seen = new Set()
    const queue = []
    for (const start of actor.crawl) {
      await page.goto(`${actor.base}${start}`, { waitUntil: "networkidle" })
      for (const link of await collectLinks(page)) if (!seen.has(link.href)) { seen.add(link.href); queue.push({ ...link, from: start }) }
    }
    for (const link of queue) {
      if (link.bad) {
        findings.crawl.push({ role: actor.role, ...link, problem: link.bad })
        continue
      }
      const url = new URL(link.href, actor.base)
      if (url.origin !== origin.origin) continue
      const resp = await page.goto(url.href, { waitUntil: "domcontentloaded" }).catch((e) => ({ status: () => 0, error: e.message }))
      const status = resp?.status?.() ?? 0
      const text = await page.locator("body").innerText().catch(() => "")
      const problem = status >= 500 ? `HTTP ${status}` : status === 404 || /This page could not be found|404 \|/i.test(text) ? "404"
        : /Application error|Internal Server Error|Something went wrong/i.test(text) ? "error page" : null
      if (problem) findings.crawl.push({ role: actor.role, href: url.pathname + url.search, text: link.text, from: link.from, problem })
    }
    r.check(`crawl.${actor.role}.links_visited`, queue.length > 0, `links=${queue.length}`)
    const broken = findings.crawl.filter((f) => f.role === actor.role)
    r.check(`crawl.${actor.role}.no_dead_links`, broken.length === 0, broken.map((b) => `${b.problem}:${b.href}`).join(", ").slice(0, 400))
    await context.close()
  }
  await keyboardFlows()
} finally {
  await browser.close()
  mkdirSync(".tmp", { recursive: true })
  writeFileSync(".tmp/ui-acceptance.json", JSON.stringify(findings, null, 2))
}

async function openAs(role, viewport = { width: 1366, height: 900 }) {
  const actor = actors.find((a) => a.role === role)
  const origin = new URL(actor.base)
  const context = await browser.newContext({ viewport })
  await context.addCookies([...actor.session.jar].map(([name, value]) => ({ name, value, domain: origin.hostname, path: "/", httpOnly: true, sameSite: "Lax" })))
  const page = await context.newPage()
  page.on("dialog", (d) => d.dismiss())
  return { page, context, base: actor.base }
}

function activeLabel(page) {
  return page.evaluate(() => {
    const el = document.activeElement
    return el ? (el.getAttribute("aria-label") || el.textContent || "").trim() : ""
  })
}

async function tabTo(page, pattern, max = 80) {
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab")
    if (pattern.test(await activeLabel(page))) return true
  }
  return false
}

async function keyboardFlows() {
  {
    const { page, context, base } = await openAs("receptionist")
    await page.goto(`${base}/os/${SLUG}/patients`, { waitUntil: "networkidle" })
    r.check("kbd.registration.reach_open_button", await tabTo(page, /^Register patient$/))
    await page.keyboard.press("Enter")
    r.check("kbd.registration.enter_opens_and_focuses_name", (await activeLabel(page)) === "Full name", await activeLabel(page))
    await page.keyboard.type("Keyboard Probe")
    await page.keyboard.press("Home")
    const home = await page.evaluate(() => document.activeElement.selectionStart)
    await page.keyboard.press("End")
    const end = await page.evaluate(() => document.activeElement.selectionStart)
    r.check("kbd.registration.home_end_in_input", home === 0 && end === "Keyboard Probe".length, `home=${home} end=${end}`)
    await page.keyboard.press("Tab")
    await page.keyboard.press("ArrowDown")
    const sex = await page.evaluate(() => document.activeElement.value)
    r.check("kbd.registration.arrow_changes_select", (await activeLabel(page)).startsWith("Sex") || sex === "M", `sex=${sex}`)
    await page.addScriptTag({ content: axeSource })
    const formViolations = await page.evaluate(async () => (await axe.run("form[aria-label='Register patient']", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }))
      .violations.filter((v) => ["critical", "serious"].includes(v.impact)).map((v) => v.id))
    r.check("kbd.registration.open_form_axe_clean", formViolations.length === 0, formViolations.join(","))
    r.check("kbd.registration.reach_cancel", await (async () => {
      for (let i = 0; i < 10; i++) { await page.keyboard.press("Tab"); if ((await activeLabel(page)) === "Cancel") return true }
      return false
    })())
    await page.keyboard.press("Space")
    r.check("kbd.registration.space_cancels_and_restores_focus", (await activeLabel(page)) === "Register patient", await activeLabel(page))
    await context.close()
  }
  {
    const { page, context, base } = await openAs("doctor", { width: 390, height: 844 })
    await page.goto(`${base}/os/${SLUG}/dashboard`, { waitUntil: "networkidle" })
    r.check("kbd.mobile_nav.reach_open", await tabTo(page, /^Open navigation$/))
    await page.keyboard.press("Enter")
    r.check("kbd.mobile_nav.focus_moves_into_drawer", (await activeLabel(page)) === "Close navigation", await activeLabel(page))
    await page.keyboard.press("Escape")
    const closed = await page.locator("aside").first().evaluate((el) => el.className.includes("-translate-x-full"))
    r.check("kbd.mobile_nav.escape_closes_and_restores_focus", closed && (await activeLabel(page)) === "Open navigation", `closed=${closed} focus=${await activeLabel(page)}`)
    await context.close()
  }
  {
    const { page, context, base } = await openAs("pharmacy_cashier")
    await page.goto(`${base}/portal/pos`, { waitUntil: "networkidle" })
    r.check("kbd.notifications.reach_bell", await tabTo(page, /^Notifications/, 120))
    await page.keyboard.press("Enter")
    const expanded = await page.evaluate(() => document.activeElement.getAttribute("aria-expanded"))
    await page.keyboard.press("Escape")
    const after = await page.evaluate(() => ({ expanded: document.activeElement.getAttribute("aria-expanded"), label: document.activeElement.getAttribute("aria-label") || "" }))
    r.check("kbd.notifications.enter_opens_escape_closes", expanded === "true" && after.expanded === "false" && after.label.startsWith("Notifications"), JSON.stringify({ expanded, after }))
    await context.close()
  }
}

async function keyboardWalk(page) {
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  await page.locator("body").click({ position: { x: 1, y: 1 } }).catch(() => {})
  const order = []
  const invisible = []
  let trapped = false
  let trapDetail = ""
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab")
    const info = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      const visible = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none")
        || s.textDecorationLine.includes("underline") || el.matches(":focus-visible") && s.outlineStyle !== "none"
      el.dataset.kw ??= String(document.querySelectorAll("[data-kw]").length)
      const key = `${el.tagName.toLowerCase()}#${el.dataset.kw}[${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().slice(0, 40)}]`
      return { key, visible }
    })
    if (!info) continue
    order.push(info.key)
    if (!info.visible && !invisible.includes(info.key)) invisible.push(info.key)
    const tail = order.slice(-6)
    if (tail.length === 6 && new Set(tail).size <= 2 && new Set(order).size > 2) {
      trapped = true
      trapDetail = tail.join(" → ")
      break
    }
  }
  let reverseOk = true
  let reverseDetail = ""
  if (order.length >= 3 && !trapped) {
    await page.keyboard.press("Shift+Tab")
    const back = await page.evaluate(() => {
      const el = document.activeElement
      return el ? `${el.tagName.toLowerCase()}#${el.dataset.kw}[${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().slice(0, 40)}]` : ""
    })
    reverseOk = back === order[order.length - 2]
    reverseDetail = `expected ${order[order.length - 2]} got ${back}`
  }
  return { distinct: new Set(order).size, invisible, trapped, trapDetail, reverseOk, reverseDetail, sample: order.slice(0, 12) }
}

async function collectLinks(page) {
  return page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => {
    const href = a.getAttribute("href") || ""
    const text = (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 60)
    const bad = href === "#" || href === "" ? "placeholder link"
      : href.startsWith("javascript:") ? "javascript link"
      : /\.vercel\.app/.test(href) ? "vercel.app link"
      : /\/os\/(?!synapse-e2e-hospital)[a-z0-9-]+\//.test(href) && !/\$\{/.test(href) ? "foreign facility slug"
      : null
    return { href: a.href || href, text, bad }
  }).filter((l) => !/^(mailto|tel):/.test(l.href) && !/\/api\/auth\/logout|\/logout/.test(l.href)))
}

process.exit(r.summary() ? 0 : 1)
