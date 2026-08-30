export const dynamic = "force-dynamic";

import Link from "next/link";
import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { getProductionTruth } from "../../../lib/platform/production-truth";
import { PlatformPageHeader } from "../_components/platform-page-header";

export default async function DeploymentsPage() {
  await requirePlatformAdmin();
  const truth = await getProductionTruth();
  const prodDeploy = truth.vercelDeployments.deployments[0];

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="Deployments"
        title="Production truth — where code is running"
        description="GitHub main vs this process vs Vercel production. Missing credentials show NOT_CONFIGURED — never fake green."
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[
          {
            label: "GitHub main SHA",
            value: truth.githubMain.shortSha ?? truth.githubMain.status,
            detail: truth.githubMain.detail,
          },
          {
            label: "This process SHA",
            value: truth.processDeploy.shortSha ?? "NOT CONFIGURED",
            detail: truth.processDeploy.detail,
          },
          {
            label: "SHA comparison",
            value: truth.shaComparison.status,
            detail: truth.shaComparison.detail,
          },
          {
            label: "Vercel production",
            value: prodDeploy?.shortSha ?? truth.vercelDeployments.status,
            detail: truth.vercelDeployments.detail,
          },
          {
            label: "Production state",
            value: prodDeploy?.state ?? "—",
            detail: prodDeploy?.url ?? "No deployment URL",
          },
          {
            label: "Checked at",
            value: new Date(truth.checkedAt).toLocaleString(),
            detail: "Live probe timestamp",
          },
        ].map((card) => (
          <article key={card.label} className="rounded-xl border border-subtle bg-surface p-4">
            <p className="text-xs uppercase text-muted-color">{card.label}</p>
            <p className="mt-2 font-mono text-sm font-semibold text-primary-color">{card.value}</p>
            <p className="mt-1 text-xs text-muted-color">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-subtle bg-surface p-4">
        <h2 className="text-sm font-semibold text-primary-color">Credential status</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              ["GITHUB_TOKEN / GH_TOKEN", truth.githubMain.status !== "NOT_CONFIGURED"],
              ["VERCEL_TOKEN + VERCEL_PROJECT_ID", truth.vercelDeployments.status !== "NOT_CONFIGURED"],
              ["VERCEL_GIT_COMMIT_SHA", Boolean(truth.processDeploy.sha)],
            ] as const
          ).map(([label, ok]) => (
            <p key={label} className="text-sm text-secondary-color">
              <span className={ok ? "text-emerald-300" : "text-red-300"}>{ok ? "✓" : "✗"}</span> {label}
            </p>
          ))}
        </div>
        <Link href="/platform/health" className="mt-4 inline-block text-xs font-semibold text-[#F97316] hover:underline">
          Full health probes →
        </Link>
      </section>
    </div>
  );
}
