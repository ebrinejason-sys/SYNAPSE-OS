import { requirePlatformAdmin } from "../../../lib/platform/auth";
import { PlatformHealthClient } from "./health-client";

export default async function PlatformHealthPage() {
  await requirePlatformAdmin();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="text-sm text-slate-400">Live monitoring polling every 30 seconds.</p>
      </div>
      <PlatformHealthClient />
    </div>
  );
}
