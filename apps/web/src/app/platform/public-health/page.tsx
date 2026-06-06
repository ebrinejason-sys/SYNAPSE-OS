import { requirePlatformAdmin } from "../../../lib/platform/auth";

export default async function PlatformPublicHealthPage() {
  await requirePlatformAdmin();

  return (
    <main className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h1 className="text-2xl font-bold">Public Health</h1>
      <p className="mt-2 text-sm text-slate-400">Cross-hospital surveillance and outbreak analytics panel is in progress.</p>
    </main>
  );
}
