// The synapse-os Vercel project builds from the repo root (Root Directory "."), so only the ROOT
// vercel.json is read; crons declared in apps/web/vercel.json are never scheduled.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const root = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"))
const crons = root.crons ?? []

test("root vercel.json schedules the billing sweep", () => {
  const sweep = crons.find((c) => c.path === "/api/cron/billing-sweep")
  assert.ok(sweep, "billing-sweep cron must be declared in the root vercel.json")
  assert.equal(sweep.schedule, "15 21 * * *")
})

test("every root cron runs at most once a day (Hobby plan limit) and targets an existing route", () => {
  for (const c of crons) {
    const [min, hour] = c.schedule.split(/\s+/)
    assert.match(min, /^\d+$/, `${c.path}: minute must be fixed`)
    assert.match(hour, /^\d+$/, `${c.path}: hour must be fixed`)
    const route = new URL(`../apps/web/src/app${c.path}/route.ts`, import.meta.url)
    assert.doesNotThrow(() => readFileSync(route), `${c.path} route exists`)
  }
})
