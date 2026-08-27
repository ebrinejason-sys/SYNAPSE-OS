export const dynamic = "force-dynamic"

import { requirePlatformAdmin } from "../../../lib/platform/auth"
import { PlatformPageHeader } from "../_components/platform-page-header"

export default async function DeploymentsPage() {
  await requirePlatformAdmin()
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null
  const env = process.env.VERCEL_ENV ?? null
  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Deployments"
        title="Where this process thinks it is running"
        description="Adapters for Vercel are prepared. Missing provider credentials display NOT CONFIGURED instead of a fake green deployment."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["This process environment", env ?? "NOT CONFIGURED"],
          ["Git SHA", sha ?? "NOT CONFIGURED"],
          ["Vercel token", process.env.VERCEL_TOKEN ? "Configured" : "NOT CONFIGURED"],
          ["EAS / Expo", process.env.EXPO_TOKEN ? "Configured" : "NOT CONNECTED"],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-subtle bg-surface p-4">
            <p className="text-xs uppercase text-muted-color">{label}</p>
            <p className="mt-2 font-mono text-sm text-primary-color">{value}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
