import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { MiniSparkline } from "./mini-sparkline";

type MetricCardProps = {
  label: string;
  value: string;
  href: string;
  sparkline?: number[];
  delta?: number | null;
  deltaLabel?: string;
};

export function MetricCard({ label, value, href, sparkline, delta, deltaLabel }: MetricCardProps) {
  const deltaUp = delta != null && delta >= 0;
  const deltaNeutral = delta == null || delta === 0;

  return (
    <Link
      href={href}
      className="group rounded-xl border border-subtle bg-surface p-4 transition hover:border-[#F97316]/35 hover:bg-elevated/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-color">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums tracking-tight text-primary-color">
            {value}
          </p>
          {!deltaNeutral ? (
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                deltaUp
                  ? "border-green-500/25 bg-green-500/10 text-green-300"
                  : "border-red-500/25 bg-red-500/10 text-red-300"
              }`}
            >
              {deltaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {deltaUp ? "+" : ""}
              {delta}% {deltaLabel ?? "vs prior period"}
            </span>
          ) : (
            <p className="mt-2 text-[10px] text-muted-color">{deltaLabel ?? "No change vs prior period"}</p>
          )}
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-[#E8B84B] opacity-70 transition group-hover:opacity-100" />
      </div>
      {sparkline && sparkline.length > 0 ? (
        <div className="mt-3 border-t border-subtle pt-3">
          <MiniSparkline values={sparkline} />
        </div>
      ) : null}
    </Link>
  );
}
