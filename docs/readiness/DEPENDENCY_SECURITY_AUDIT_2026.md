# Dependency Security Audit 2026

Date: 2026-09-09
Repository baseline: `e436f533993d1fc24af5efe23a63fb39ba9541ca`

## Snapshot

The current valid dependency graph reports 76 findings: 4 low, 37 moderate, 34 high, and 1 critical. The attempted targeted remediation was not retained because it produced an invalid npm graph or left the Vercel tar advisory unresolved. No `npm audit fix --force` was used.

The current output is dominated by the monorepo's Expo/mobile and build toolchain. A finding is not automatically a production-runtime exploit: package path, reachability, and whether untrusted input reaches the vulnerable parser still need review.

## Classification

| Package/path | Severity observed | Classification | Initial disposition |
|---|---|---|---|
| Expo / `@expo/cli` dependency chain | High and transitive findings | Build/dev and mobile release toolchain | Do not force-upgrade during Wave 0; schedule a compatibility-bounded Expo upgrade and rerun Android/export gates. |
| `brace-expansion`, `browserslist`, `cacache` | High, transitive | Build/dev dependency paths | Not established as web production runtime paths from this audit; pin/upgrade through lockfile-compatible parent upgrades. |
| `fast-uri` | High, transitive | Transitive URI parser | Requires reachability review in server/runtime dependency graph before calling exploitable; prioritize parent package upgrade. |
| XML parser chain such as `xmldom` / Expo plist | Moderate/high transitive findings | Mobile/build dependency path | Treat as build-time unless runtime import evidence says otherwise. |
| `tar` under `@vercel/fun` | Critical | CLI/build-only transitive dependency via Vercel tooling | Upstream `@vercel/fun@1.3.1` still requests vulnerable `tar@7.5.7`; a scoped tar 7.5.22 override did not take effect in the reproducible install. Keep blocked pending a compatible upstream fix. |

## Policy

- Do not use `npm audit fix --force`.
- Do not upgrade Expo or Next transitively without running web build, pharmacy regression, and Android export gates.
- Critical/high packages reachable from deployed server bundles require a targeted fix or documented mitigation before controlled pilot.
- Build-only/mobile-only findings remain release risk, but do not get conflated with web server runtime exposure.

## Current Decision

Dependency status is **YELLOW**. The critical finding is in a CLI/build-only Vercel path rather than the deployed web runtime, but the graph cannot be called clean until the upstream package publishes a compatible tar fix.