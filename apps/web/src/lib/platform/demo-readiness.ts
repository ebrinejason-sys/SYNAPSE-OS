/** Synthetic Demo does not use the service-role database. Absence is intentional, not a failed required probe. */
export function demoDatabaseIntentionallyDisabled(env: NodeJS.ProcessEnv = process.env) {
  return (env.VERCEL_PROJECT_PRODUCTION_URL ?? "").includes("demo.synapseos.tech")
}
