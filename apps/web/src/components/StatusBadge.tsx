import type { IntegrationStatus, ManifestStatus } from "@synapse/config/manifest"
import { integrationLabel, statusLabel } from "@synapse/config/manifest"

const STATUS_CLASS: Record<string, string> = {
  operational: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  operational_candidate: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  pilot: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  development: "border-[#E8B84B]/30 bg-[#E8B84B]/10 text-[#E8B84B]",
  partial: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  prototype: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  placeholder: "border-zinc-700 bg-zinc-800/60 text-zinc-400",
  roadmap: "border-zinc-700 bg-transparent text-zinc-400",
  paused: "border-zinc-600 bg-zinc-800 text-zinc-400",
  incident: "border-red-500/40 bg-red-500/10 text-red-300",
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  not_connected: "border-zinc-600 bg-zinc-800/80 text-zinc-400",
}

export function StatusBadge({
  status,
  kind = "capability",
}: {
  status: ManifestStatus | IntegrationStatus | string
  kind?: "capability" | "integration"
}) {
  const label = kind === "integration" ? integrationLabel(status as IntegrationStatus) : statusLabel(status as ManifestStatus)
  const cls = STATUS_CLASS[status] ?? STATUS_CLASS.roadmap
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}
