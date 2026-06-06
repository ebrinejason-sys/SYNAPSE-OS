import { requirePlatformAdmin } from "../../../lib/platform/auth";

export default async function PlatformSupportPage() {
  await requirePlatformAdmin();

  return (
    <main className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h1 className="text-2xl font-bold">Support</h1>
      <p className="mt-2 text-sm text-slate-400">Ticketing, escalation, and tenant support tooling will appear here.</p>
    </main>
  );
}
