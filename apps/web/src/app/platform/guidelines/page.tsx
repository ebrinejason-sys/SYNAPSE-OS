import { requirePlatformAdmin } from "../../../lib/platform/auth";

export default async function PlatformGuidelinesPage() {
  await requirePlatformAdmin();

  return (
    <main className="min-h-screen bg-synapse-950 text-white p-8">
      <h1 className="font-display text-2xl">Clinical Guidelines</h1>
      <p className="text-gray-400 mt-2">Coming soon.</p>
    </main>
  );
}
