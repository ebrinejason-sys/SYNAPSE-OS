"use client"

import { applyStationSession, stationHref, type DemoStationId } from "../../lib/demo/stations"

export function DemoEmptyState({
  title,
  body,
  primaryLabel,
  primaryStation,
  secondaryLabel,
  secondaryStation,
}: {
  title: string
  body: string
  primaryLabel: string
  primaryStation: DemoStationId
  secondaryLabel?: string
  secondaryStation?: DemoStationId
}) {
  return (
    <div className="demo-empty" role="status">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{body}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a className="demo-btn-primary" href={stationHref(primaryStation)} onClick={() => applyStationSession(primaryStation)}>
          {primaryLabel}
        </a>
        {secondaryLabel && secondaryStation ? (
          <a className="demo-btn-secondary" href={stationHref(secondaryStation)} onClick={() => applyStationSession(secondaryStation)}>
            {secondaryLabel}
          </a>
        ) : null}
      </div>
    </div>
  )
}
