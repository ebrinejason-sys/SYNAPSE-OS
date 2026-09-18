#!/usr/bin/env node
/**
 * Production route inventory + link integrity gate.
 * A page existing is not functionality. Production nav must not reach
 * ROADMAP, DEPRECATED, Demo-only, or missing destinations.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = process.cwd()
const appRoot = join(root, "apps/web/src/app")
const DEMO_PREFIX = "/demo"

/** @typedef {"ACTIVE" | "FEATURE_GATED" | "REDIRECT" | "ROADMAP" | "DEPRECATED" | "DEMO"} Classification */

const FEATURE_GATED_PREFIXES = ["/platform/", "/health/", "/tele/", "/onboarding/", "/patient/"]
const DEPRECATED_EXACT = new Set([])
const MARKETING_ROADMAP = new Set([
  "/about",
  "/blog",
  "/features",
  "/careers",
  "/changelog",
  "/docs",
  "/press",
  "/status",
  "/sdg",
])

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return [path]
  })
}

function pageToRoute(file) {
  const rel = relative(appRoot, file).replace(/\\/g, "/")
  const withoutFile = rel.replace(/\/page\.(tsx|jsx|ts|js)$/, "")
  if (withoutFile === "page.tsx" || withoutFile === "") return "/"
  const segments = withoutFile.split("/").filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
  return "/" + segments.map((seg) => (seg.startsWith("@") ? null : seg)).filter(Boolean).join("/")
}

function parseRedirects(source) {
  const redirects = []
  const re = /source:\s*"([^"]+)"\s*,\s*destination:\s*"([^"]+)"/g
  let match
  while ((match = re.exec(source))) {
    redirects.push({ source: match[1], destination: match[2] })
  }
  return redirects
}

function classifyPage(route, source, redirects) {
  if (route === DEMO_PREFIX || route.startsWith(`${DEMO_PREFIX}/`)) return "DEMO"
  if (DEPRECATED_EXACT.has(route)) return "DEPRECATED"
  if (redirects.some((row) => row.source === route || globToRegExp(row.source).test(route))) return "REDIRECT"
  if (/FacilityCanonicalRedirect|redirect\(|router\.replace\(/.test(source) && /Coming soon/.test(source) === false) {
    if (/FacilityCanonicalRedirect|redirect\(|router\.replace\(/.test(source)) return "REDIRECT"
  }
  if (/Coming soon\.?/.test(source) || /<ComingSoon[\s>]/.test(source)) {
    if (MARKETING_ROADMAP.has(route) || route.startsWith("/legal/") || route.startsWith("/blog/")) return "ROADMAP"
    return "ROADMAP"
  }
  if (FEATURE_GATED_PREFIXES.some((prefix) => route === prefix.slice(0, -1) || route.startsWith(prefix))) {
    if (!/Coming soon/.test(source)) return "FEATURE_GATED"
  }
  return "ACTIVE"
}

function globToRegExp(pattern) {
  const withParams = pattern.replace(/\[([^\]]+)\]/g, ":$1")
  const escaped = withParams.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escaped.replace(/:([A-Za-z0-9_]+)/g, "[^/]+")}$`)
}

function extractInternalHrefs(source) {
  const hrefs = new Set()
  const patterns = [
    /href:\s*['"](\/[^'"]*)['"]/g,
    /href=\{?['"](\/[^'"]*)['"]/g,
    /<Link[^>]*href=["'](\/[^"']*)["']/g,
    /router\.(?:push|replace)\(["'](\/[^"']*)["']\)/g,
    /redirect\(["'](\/[^"']*)["']\)/g,
  ]
  for (const re of patterns) {
    let match
    while ((match = re.exec(source))) hrefs.add(match[1].split("?")[0].split("#")[0])
  }
  for (const match of source.matchAll(/`(\/os\/\$\{slug\}[^`]*)`/g)) {
    hrefs.add(match[1].replace("${slug}", "pilot-hospital"))
  }
  for (const match of source.matchAll(/`\$\{base\}([^`]*)`/g)) {
    hrefs.add(`/os/pilot-hospital${match[1]}`)
  }
  return [...hrefs]
}

function routeExists(route, pages, redirects) {
  if (pages.has(route)) return true
  for (const candidate of pages) {
    if (globToRegExp(candidate).test(route)) return true
  }
  return redirects.some((row) => globToRegExp(row.source).test(route) || row.source === route)
}

export function buildRouteIntegrity(options = {}) {
  const pages = new Map()
  if (!existsSync(appRoot)) throw new Error("apps/web/src/app missing")
  for (const file of walk(appRoot).filter((path) => /\/page\.(tsx|jsx|ts|js)$/.test(path))) {
    const route = pageToRoute(file)
    const source = readFileSync(file, "utf8")
    pages.set(route, { route, sourceFile: relative(root, file).replace(/\\/g, "/"), source })
  }

  const nextConfig = readFileSync(join(root, "apps/web/next.config.ts"), "utf8")
  const redirects = parseRedirects(nextConfig)

  const manifest = []
  for (const [route, page] of [...pages.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (route.startsWith(DEMO_PREFIX)) continue
    manifest.push({
      route,
      source_file: page.sourceFile,
      classification: classifyPage(route, page.source, redirects),
    })
  }

  const byRoute = new Map(manifest.map((row) => [row.route, row]))
  const navFiles = [
    "apps/web/src/lib/production-navigation.ts",
    "apps/web/src/components/AppSidebar.tsx",
    "apps/web/src/app/os/[slug]/layout.tsx",
    "apps/web/src/app/hospital/admin/layout.tsx",
    "apps/web/src/app/admin/layout.tsx",
    "apps/web/src/app/admin/settings/page.tsx",
    "apps/web/src/app/encounter/[id]/page.tsx",
    "apps/web/src/app/doctor/page.tsx",
    "apps/web/src/app/nurse/page.tsx",
  ]

  const presented = []
  const failures = []
  const pageSet = new Set(pages.keys())

  for (const file of navFiles) {
    const abs = join(root, file)
    if (!existsSync(abs)) {
      failures.push({ type: "missing_nav_file", file })
      continue
    }
    const source = readFileSync(abs, "utf8")
    if (source.includes('href="#"') || source.includes("href='#'")) {
      failures.push({ type: "hash_href", file })
    }
    for (const href of extractInternalHrefs(source)) {
      if (href.startsWith("/api/") || href.startsWith("/fhir")) continue
      presented.push({ href, file })
      const concrete = href.replaceAll("${slug}", "pilot-hospital").replaceAll("${base}", "/os/pilot-hospital")
      if (concrete.includes("${")) continue
      if (concrete.startsWith(DEMO_PREFIX) || concrete.startsWith("/demo/")) {
        failures.push({ type: "production_link_to_demo", href: concrete, file })
        continue
      }
      const classified = classifyPresented(concrete, byRoute, redirects)
      if (classified === "ROADMAP") failures.push({ type: "roadmap_destination", href: concrete, file })
      if (classified === "DEPRECATED") failures.push({ type: "deprecated_destination", href: concrete, file })
      if (!routeExists(concrete, pageSet, redirects) && !routeExists(normalizeRoute(concrete), pageSet, redirects)) {
        failures.push({ type: "missing_page", href: concrete, file })
      }
    }
  }

  const comingSoon = manifest.filter((row) => row.classification === "ROADMAP").length
  const result = {
    generated_at: new Date().toISOString(),
    production_page_count: manifest.length,
    presented_link_count: presented.length,
    coming_soon_pages: comingSoon,
    redirects: redirects.length,
    failures,
    manifest,
  }

  if (!options.skipWrite) {
    const outDir = join(root, "artifacts/readiness")
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, "web-route-manifest.json"), JSON.stringify({ generated_at: result.generated_at, routes: manifest }, null, 2))
    writeFileSync(join(outDir, "route-integrity.json"), JSON.stringify({
      generated_at: result.generated_at,
      status: failures.length ? "FAIL" : "PASS",
      presented_link_count: presented.length,
      coming_soon_pages: comingSoon,
      failures,
    }, null, 2))
  }
  return result
}

function normalizeRoute(href) {
  return href.replace(/\/os\/[^/]+/g, "/os/[slug]").replace(/\/encounter\/[^/]+/g, "/encounter/[id]").replace(/\/patients\/[^/]+/g, "/os/[slug]/patients/[id]")
}

function classifyPresented(href, byRoute, redirects) {
  const normalized = normalizeRoute(href)
  if (redirects.some((row) => globToRegExp(row.source).test(href) || globToRegExp(row.source).test(normalized))) return "REDIRECT"
  return byRoute.get(normalized)?.classification ?? byRoute.get(href)?.classification ?? "ACTIVE"
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) {
  const result = buildRouteIntegrity()
  if (result.failures.length) {
    console.error(`Route integrity FAIL (${result.failures.length})`)
    for (const failure of result.failures.slice(0, 50)) console.error(JSON.stringify(failure))
    process.exit(1)
  }
  console.log(`Route integrity PASS pages=${result.production_page_count} nav_links=${result.presented_link_count} roadmap=${result.coming_soon_pages}`)
}
