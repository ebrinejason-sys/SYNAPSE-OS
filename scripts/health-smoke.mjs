#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? 5000)
const environment = process.env.HEALTH_ENVIRONMENT ?? process.env.VERCEL_ENV ?? "local"
const configuredSurfaces = process.env.HEALTH_SURFACES ?? process.env.PRODUCTION_URL ?? ""
const urls = configuredSurfaces.split(",").map((value) => value.trim()).filter(Boolean)

function result(url, status, startedAt, detail, httpStatus = null) {
  return { url, status, latencyMs: Date.now() - startedAt, timestamp: new Date().toISOString(), source: "health-smoke", environment, detail, httpStatus }
}

async function probe(url) {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { method: "GET", redirect: "manual", signal: controller.signal, cache: "no-store" })
    clearTimeout(timer)
    if (response.status >= 200 && response.status < 400) return result(url, "PASS", startedAt, "reachable", response.status)
    if (response.status === 401 || response.status === 403) return result(url, "PASS", startedAt, "reachable; authentication expected", response.status)
    if (response.status >= 400 && response.status < 500) return result(url, "DEGRADED", startedAt, "client response", response.status)
    return result(url, "FAILING", startedAt, "server response", response.status)
  } catch (error) {
    clearTimeout(timer)
    return result(url, "FAILING", startedAt, error?.name === "AbortError" ? "timeout" : "unreachable")
  }
}

const probes = urls.length ? await Promise.all(urls.map(probe)) : []
const overall = probes.some((item) => item.status === "FAILING") ? "FAILING" : probes.some((item) => item.status === "DEGRADED") ? "DEGRADED" : probes.length ? "PASS" : "NOT_CONFIGURED"
const evidence = { overall, generatedAt: new Date().toISOString(), source: "health-smoke", environment, timeoutMs, probes }

await mkdir(join(process.cwd(), "artifacts", "readiness"), { recursive: true })
await writeFile(join(process.cwd(), "artifacts", "readiness", "health-smoke.json"), `${JSON.stringify(evidence, null, 2)}\n`)
console.log(JSON.stringify(evidence, null, 2))
if (overall === "FAILING") process.exitCode = 1
