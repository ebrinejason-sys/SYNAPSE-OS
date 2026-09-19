#!/usr/bin/env node
/**
 * Vercel ignoreCommand gate — exit 1 = build, exit 0 = skip (cancel deploy).
 * @see https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
 *
 * Preview/development always builds. Production OS/Pharmacy Git deploys stay
 * skipped so promotion remains acceptance-gated. Demo production is allowed.
 *
 * Do not run type-check here: ignoreCommand often runs before install, which
 * would cancel every OS preview.
 */
import { pathToFileURL } from "node:url"

export function vercelGitDeployDecision(env = process.env) {
  if (env.VERCEL_ENV === "production") {
    const productionUrl = env.VERCEL_PROJECT_PRODUCTION_URL ?? ""
    const isDemoProject = productionUrl.includes("demo.synapseos.tech")
    if (!isDemoProject) {
      return { skip: true, reason: "production OS/Pharmacy git deploy is acceptance-gated" }
    }
    return { skip: false, reason: "demo production host" }
  }
  return { skip: false, reason: "preview/dev always builds" }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const decision = vercelGitDeployDecision()
  if (decision.skip) {
    console.log(`[vercel-build-gate] Skipping Git production deploy. ${decision.reason}`)
    process.exit(0)
  }
  console.log(`[vercel-build-gate] ${decision.reason} — proceeding with Vercel build.`)
  process.exit(1)
}
