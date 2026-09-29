'use client'

import { useEffect, useRef, useState } from 'react'
import { platformNotices, type PlatformNotice } from './notice-bus'

/** Persistent, focusable live region for row-action confirmations. */
export function PlatformNoticeRegion() {
  const [notice, setNotice] = useState<PlatformNotice | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => platformNotices.subscribe(setNotice), [])

  useEffect(() => {
    // The acting row may have left the filtered list; move focus here so
    // keyboard and screen-reader users are not dropped onto <body>.
    if (notice) ref.current?.focus()
  }, [notice])

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={notice?.kind === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      data-testid="platform-notice"
      className={
        notice
          ? `flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#E8B84B] ${
              notice.kind === 'error' ? 'border-red-700/50 text-red-300' : 'border-emerald-600/40 text-emerald-300'
            }`
          : 'sr-only'
      }
    >
      {notice ? (
        <>
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded-md border border-slate-700 px-2 py-0.5 text-xs text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8B84B]"
          >
            Dismiss
          </button>
        </>
      ) : null}
    </div>
  )
}
