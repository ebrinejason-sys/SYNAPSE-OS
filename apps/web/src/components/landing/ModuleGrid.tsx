'use client'

import { useState } from 'react'

type Module = { abbr: string; name: string; desc: string }

const INITIAL_COUNT = 8

export function ModuleGrid({ modules }: { modules: Module[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? modules : modules.slice(0, INITIAL_COUNT)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((m) => (
          <div key={m.name} className="landing-card landing-card-quiet !p-4">
            <span className="mb-2 inline-block rounded-md border border-subtle bg-elevated px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-secondary-color">
              {m.abbr}
            </span>
            <p className="text-sm font-semibold text-primary-color">{m.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-color">{m.desc}</p>
          </div>
        ))}
      </div>
      {modules.length > INITIAL_COUNT && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="landing-btn-secondary mt-6">
          {expanded ? 'Show fewer modules' : `Show all ${modules.length} modules`}
        </button>
      )}
    </div>
  )
}
