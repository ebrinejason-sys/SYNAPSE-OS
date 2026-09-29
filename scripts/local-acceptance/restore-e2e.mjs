#!/usr/bin/env node
// Local Restore E2E: archived Platform Admin A beyond the first directory page is found,
// restored by keyboard by Platform Admin B, and keeps membership, MFA and password-change state.
import { chromium } from "playwright"
import { assertLocalTargets, BASE, ensurePlatformUser, platformLogin, Report, Session, sql, sqlJson } from "./lib.mjs"

assertLocalTargets()
const r = new Report("restore-e2e")
const stamp = Date.now().toString(36)

const MIN_PROFILES = 260
const have = Number(sql("select count(*) from profiles"))
if (have < MIN_PROFILES) {
  sql(`insert into profiles (id, email, full_name, role, verification_status, created_at)
select gen_random_uuid(), 'filler-' || g || '-${stamp}.e2e@synapseos.invalid', 'Directory Filler ' || g, 'clinician', 'pending', now()
from generate_series(1, ${MIN_PROFILES - have}) g`)
}
const totalProfiles = Number(sql("select count(*) from profiles"))
r.check("fixture.profiles_at_least_250", totalProfiles >= 250, `profiles=${totalProfiles}`)

const A = ensurePlatformUser({ email: "platform-a.e2e@synapseos.invalid", name: "Restore Target A", createdAt: "2021-01-01T00:00:00Z", mustChangePassword: true })
const B = ensurePlatformUser({ email: "platform-b.e2e@synapseos.invalid", name: "Restore Operator B" })
const stateOf = (id) => sqlJson(`select p.is_deleted, p.must_change_password, p.role, p.verification_status,
  (select json_agg(json_build_object('id', m.id, 'role', m.platform_role, 'status', m.status, 'mfa', m.mfa_required)) from platform_memberships m where m.user_id = p.id) memberships,
  (select json_agg(json_build_object('id', e.id, 'secret', md5(e.secret), 'verified', e.verified)) from mfa_enrollments e where e.user_id = p.id) mfa
  from profiles p where p.id = '${id}'`)[0]

sql(`update profiles set is_deleted = true where id = '${A.id}'; delete from synapse_sessions where user_id = '${A.id}';`)
const archived = stateOf(A.id)
r.check("fixture.a_archived", archived.is_deleted === true && archived.must_change_password === true)

// API: an archived identity cannot sign in; the response must not reveal the state before the password is proven.
const probe = await new Session("probe").call("POST", "/api/auth/password-login", { email: A.email, password: "definitely-wrong-password" })
r.check("api.archived_wrong_password_generic", probe.status === 401, `HTTP ${probe.status}`)
let archivedLoginBlocked = false
try { await platformLogin(A, "A-archived") } catch { archivedLoginBlocked = true }
r.check("api.archived_login_blocked", archivedLoginBlocked)

const operator = await platformLogin(B, "B")
const firstPage = await fetch(`${BASE}/platform/users`, { headers: { cookie: operator.cookie() }, redirect: "manual" })
r.check("api.directory_page1_200", firstPage.status === 200, `HTTP ${firstPage.status}`)
const pageHtml = await firstPage.text()
r.check("directory.a_not_on_first_page", !pageHtml.includes(A.email), "A appears on page 1")
const totalMatch = pageHtml.match(/of\s*(?:<!-- -->)?\s*([\d,]+)\s*(?:<!-- -->)?\s*matching profiles/)
r.check("directory.total_at_least_250", totalMatch && Number(totalMatch[1].replace(/,/g, "")) >= 250, totalMatch?.[0] ?? "total not rendered")
const archivedView = await (await fetch(`${BASE}/platform/users?status=archived&q=${encodeURIComponent(A.email)}`, { headers: { cookie: operator.cookie() } })).text()
r.check("directory.archived_filter_finds_a", archivedView.includes(A.email))

// Browser: B signs in via session cookie, searches and restores A using only the keyboard.
const browser = await chromium.launch()
try {
  const context = await browser.newContext()
  const origin = new URL(BASE)
  await context.addCookies([...operator.jar].map(([name, value]) => ({ name, value, domain: origin.hostname, path: "/", httpOnly: true, sameSite: "Lax" })))
  const page = await context.newPage()
  page.on("dialog", (d) => d.dismiss())
  await page.goto(`${BASE}/platform/users`)
  r.check("browser.page1_excludes_a", !(await page.content()).includes(A.email))

  const tabUntil = async (predicate, max = 120) => {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press("Tab")
      if (await page.evaluate(predicate)) return true
    }
    return false
  }
  const reachedSearch = await tabUntil(() => document.activeElement?.id === "user-q")
  r.check("keyboard.tab_to_search", reachedSearch)
  await page.keyboard.type(A.email)
  await Promise.all([page.waitForURL(/q=/), page.keyboard.press("Enter")])
  await page.waitForLoadState("networkidle")
  r.check("browser.search_finds_a", (await page.content()).includes(A.email))

  const email = A.email
  const reachedRestore = await tabUntil(new Function(`const el = document.activeElement; return el?.tagName === "BUTTON" && el.textContent.trim() === "Restore" && el.closest('[aria-label="Actions for ${email}"]') !== null`))
  r.check("keyboard.tab_to_restore", reachedRestore)
  const focusVisible = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== "none")
  r.check("keyboard.restore_focus_visible", focusVisible)
  await page.keyboard.press("Enter")
  const notice = page.getByTestId("platform-notice")
  await notice.getByText("Identity restored.", { exact: false }).waitFor({ timeout: 20000 })
  r.check("browser.identity_restored_message", true)
  const focus = await page.evaluate(() => ({ testid: document.activeElement?.getAttribute("data-testid"), tag: document.activeElement?.tagName }))
  r.check("keyboard.focus_moves_to_notice", focus.testid === "platform-notice", JSON.stringify(focus))
  await context.close()
} finally {
  await browser.close()
}

const restored = stateOf(A.id)
r.check("db.a_restored", restored.is_deleted === false)
r.check("db.membership_preserved", JSON.stringify(restored.memberships) === JSON.stringify(archived.memberships), JSON.stringify(restored.memberships))
r.check("db.mfa_preserved", JSON.stringify(restored.mfa) === JSON.stringify(archived.mfa))
r.check("db.must_change_password_preserved", restored.must_change_password === true)
r.check("db.role_preserved", restored.role === archived.role)
const audit = sqlJson(`select action, user_id, record_id, old_value, new_value from audit_log where action = 'user.restored' and record_id = '${A.id}' and user_id = '${B.id}' order by created_at desc limit 1`)
r.check("audit.user_restored_row", audit.length === 1 && audit[0].old_value?.is_deleted === true, JSON.stringify(audit))

// After restore A signs in through the normal path again and still has to change the password.
const afterLogin = await platformLogin(A, "A-restored").then((s) => s, (e) => e)
r.check("api.restored_login_reaches_session", !(afterLogin instanceof Error), String(afterLogin?.message ?? ""))

process.exit(r.summary() ? 0 : 1)
