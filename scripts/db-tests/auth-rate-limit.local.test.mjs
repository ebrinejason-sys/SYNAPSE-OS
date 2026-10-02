// Distributed limiter (consume_auth_rate_limit) against a LOCAL Supabase.
// Skipped unless LOCAL_API_URL/LOCAL_SERVICE_ROLE_KEY point at 127.0.0.1/localhost.
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createHmac, randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"

const URL_ = process.env.LOCAL_API_URL ?? ""
const KEY = process.env.LOCAL_SERVICE_ROLE_KEY ?? ""
const ANON = process.env.LOCAL_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const isLocal = /^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(URL_) && KEY.length > 0
const skip = isLocal ? false : "local Supabase env not set (LOCAL_API_URL / LOCAL_SERVICE_ROLE_KEY)"
const client = () => createClient(URL_, KEY, { auth: { persistSession: false } })
const key = (id) => createHmac("sha256", "test-pepper").update(`test|${id}`).digest("hex")
const consume = (db, k, limit, win) => db.rpc("consume_auth_rate_limit", { p_bucket_key: k, p_limit: limit, p_window_seconds: win })

describe("consume_auth_rate_limit (real Postgres)", { skip }, () => {
  it("20 concurrent requests with limit 5: exactly 5 allowed", async () => {
    const db = client()
    const k = key(randomUUID())
    const res = await Promise.all(Array.from({ length: 20 }, () => consume(db, k, 5, 60)))
    for (const r of res) assert.equal(r.error, null)
    assert.equal(res.filter((r) => r.data.allowed).length, 5)
    assert.deepEqual(res.map((r) => r.data.hits).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it("a separate process shares the same state", async () => {
    const k = key(randomUUID())
    const db = client()
    for (let i = 0; i < 3; i += 1) await consume(db, k, 3, 60)
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import { createClient } from "@supabase/supabase-js"
      const db = createClient(process.env.LOCAL_API_URL, process.env.LOCAL_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      const { data } = await db.rpc("consume_auth_rate_limit", { p_bucket_key: process.argv[1], p_limit: 3, p_window_seconds: 60 })
      process.stdout.write(JSON.stringify(data))
    `, k], { env: process.env, cwd: process.cwd() }).toString()
    const data = JSON.parse(out)
    assert.equal(data.allowed, false)
    assert.equal(data.hits, 4)
  })

  it("the window expiring allows again", async () => {
    const db = client()
    const k = key(randomUUID())
    assert.equal((await consume(db, k, 1, 1)).data.allowed, true)
    assert.equal((await consume(db, k, 1, 1)).data.allowed, false)
    await new Promise((r) => setTimeout(r, 1200))
    const again = await consume(db, k, 1, 1)
    assert.equal(again.data.allowed, true)
    assert.equal(again.data.hits, 1)
  })

  it("rejects raw identifiers as keys and stores only 64-hex keys", async () => {
    const db = client()
    const bad = await consume(db, "203.0.113.5", 5, 60)
    assert.ok(bad.error, "raw IP must be rejected")
    const { data: rows } = await db.from("auth_rate_limit_buckets").select("bucket_key").limit(500)
    for (const r of rows ?? []) assert.match(r.bucket_key, /^[0-9a-f]{64}$/)
  })

  it("anon cannot call the limiter or read buckets", { skip: ANON ? false : "no anon key" }, async () => {
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } })
    const r = await consume(anon, key("x"), 5, 60)
    assert.ok(r.error)
    const t = await anon.from("auth_rate_limit_buckets").select("bucket_key").limit(1)
    assert.ok(t.error || (t.data ?? []).length === 0)
  })
})
