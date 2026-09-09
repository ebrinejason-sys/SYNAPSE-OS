# Dependency Security Audit 2026

Date: 2026-09-09
Repository baseline: `e436f533993d1fc24af5efe23a63fb39ba9541ca`

## Snapshot

`npm audit` reported 77 findings: 4 low, 34 moderate, 37 high, and 2 critical. The audit was classified without running `npm audit fix --force`.

The current output is dominated by the monorepo's Expo/mobile and build toolchain. A finding is not automatically a production-runtime exploit: package path, reachability, and whether untrusted input reaches the vulnerable parser still need review.

## Classification

| Package/path | Severity observed | Classification | Initial disposition |
|---|---|---|---|
| Expo / `@expo/cli` dependency chain | High and transitive findings | Build/dev and mobile release toolchain | Do not force-upgrade during Wave 0; schedule a compatibility-bounded Expo upgrade and rerun Android/export gates. |
| `brace-expansion`, `browserslist`, `cacache` | High, transitive | Build/dev dependency paths | Not established as web production runtime paths from this audit; pin/upgrade through lockfile-compatible parent upgrades. |
| `fast-uri` | High, transitive | Transitive URI parser | Requires reachability review in server/runtime dependency graph before calling exploitable; prioritize parent package upgrade. |
| XML parser chain such as `xmldom` / Expo plist | Moderate/high transitive findings | Mobile/build dependency path | Treat as build-time unless runtime import evidence says otherwise. |
| Critical findings | 2 reported by the CI snapshot | Not yet attributed to a production package in this local summary | Must be enumerated from the CI `npm audit` artifact and assigned an owner before pilot sign-off. |

## Policy

- Do not use `npm audit fix --force`.
- Do not upgrade Expo or Next transitively without running web build, pharmacy regression, and Android export gates.
- Critical/high packages reachable from deployed server bundles require a targeted fix or documented mitigation before controlled pilot.
- Build-only/mobile-only findings remain release risk, but do not get conflated with web server runtime exposure.

## Current Decision

Dependency status is **YELLOW**. The count is documented and partially classified, but the two critical findings require the full CI audit artifact or a package-path report to identify exact advisories and remediation owners.