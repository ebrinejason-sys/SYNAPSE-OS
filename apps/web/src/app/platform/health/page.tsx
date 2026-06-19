import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { PlatformHealthClient } from "./health-client";
import { PlatformPageHeader } from "../_components/platform-page-header";

export default async function PlatformHealthPage() {
  await requirePlatformAdmin();

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        eyebrow="System"
        title="Speed Insights"
        description="Runtime health, deployment status, and performance observability across Synapse apps."
      />
      <PlatformHealthClient />
    </div>
  );
}
