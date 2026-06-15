'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>

      <div className="max-w-md space-y-2">
        <h2 className="text-xl font-semibold text-primary-color">Something went wrong</h2>
        <p className="text-sm text-muted-color">
          {error.message?.includes('Session') || error.message?.includes('auth')
            ? 'Your session could not be verified. Try refreshing or signing in again.'
            : 'An unexpected error occurred loading this page.'}
        </p>
        {error.digest ? (
          <p className="font-mono text-[10px] text-muted-color">Error ID: {error.digest}</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-xl border border-[#F97316]/30 bg-[#F97316]/10 px-4 py-2 text-sm font-semibold text-[#F97316] transition hover:bg-[#F97316]/20"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  )
}
