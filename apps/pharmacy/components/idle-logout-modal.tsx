"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { useIdleLogout } from "@/hooks/use-idle-logout"

export function IdleLogoutModal() {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/login?reason=idle")
    router.refresh()
  }, [router])

  useIdleLogout({
    onWarn: useCallback((secs: number) => setSecondsLeft(secs), []),
    onLogout: handleLogout,
    onReset: useCallback(() => setSecondsLeft(null), []),
  })

  if (secondsLeft === null) return null

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-foreground">Still there?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ll be signed out in{" "}
          <span className="font-semibold text-foreground">{timeStr}</span> due to inactivity.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => setSecondsLeft(null)}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  )
}
