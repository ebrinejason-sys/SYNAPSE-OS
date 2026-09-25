"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"

type LifecycleState = "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "DELETION_PENDING" | "DELETED"

type Preview = {
  currentState: LifecycleState
  action: string
  nextState: LifecycleState | null
  allowed: boolean
  hardPurgeAllowed: boolean
  retainClinicalHistory: boolean
  retainFinancialHistory: boolean
  retainAuditHistory?: boolean
  blockers: string[]
  counts: {
    staffExclusive: number
    staffShared: number
    patients: number
    encounters: number
    invoices: number
    prescriptions?: number
    labOrders?: number
    payments?: number
    subscriptions?: number
    signedDocuments?: number
    referrals?: number
    deathRecords?: number
    mortuaryRecords?: number
    auditEvents?: number
    devices?: number
    memberships?: number
  }
  correlationId?: string
}

type Snapshot = {
  tenantId: string
  name: string
  currentState: LifecycleState
  counts: Preview["counts"]
}

const ACTIONS: Array<{
  action: string
  label: string
  needsReason: boolean
  destructive?: boolean
  purge?: boolean
}> = [
  { action: "suspend", label: "Suspend", needsReason: true },
  { action: "resume", label: "Reactivate", needsReason: false },
  { action: "archive", label: "Archive", needsReason: true },
  { action: "restore", label: "Restore from archive", needsReason: false },
  { action: "request_delete", label: "Request permanent deletion", needsReason: true, destructive: true },
  { action: "cancel_delete", label: "Cancel deletion request", needsReason: false },
  { action: "purge", label: "Permanently purge (synthetic only)", needsReason: true, destructive: true, purge: true },
]

export function FacilityLifecyclePanel({
  facilityId,
  facilityName,
}: {
  facilityId: string
  facilityName: string
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<(typeof ACTIONS)[number] | null>(null)
  const [reason, setReason] = useState("")
  const [confirmName, setConfirmName] = useState("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [ack, setAck] = useState(false)
  const [mfaCode, setMfaCode] = useState("")
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descId = useId()

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/platform/facilities/${facilityId}/lifecycle`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error ?? "Could not load lifecycle state")
      return
    }
    setSnapshot(data as Snapshot)
  }, [facilityId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (dialog) {
      if (!el.open) el.showModal()
      const focusable = el.querySelector<HTMLElement>("textarea, input, button")
      focusable?.focus()
    } else if (el.open) {
      el.close()
      triggerRef.current?.focus()
    }
  }, [dialog])

  function openAction(action: (typeof ACTIONS)[number], ev: React.MouseEvent | React.KeyboardEvent) {
    triggerRef.current = ev.currentTarget as HTMLElement
    setDialog(action)
    setReason("")
    setConfirmName("")
    setAck(false)
    setMfaCode("")
    setError(null)
    setMessage(null)
    // Impact preview from last GET snapshot (no mutating dry-run).
    if (snapshot) {
      setPreview({
        currentState: snapshot.currentState,
        action: action.action,
        nextState: null,
        allowed: true,
        hardPurgeAllowed: false,
        retainClinicalHistory: snapshot.counts.patients > 0 || snapshot.counts.encounters > 0,
        retainFinancialHistory: snapshot.counts.invoices > 0,
        blockers:
          action.purge && (snapshot.counts.patients > 0 || snapshot.counts.encounters > 0 || snapshot.counts.invoices > 0)
            ? ["Hard purge blocked while clinical or financial history exists"]
            : [],
        counts: snapshot.counts,
      })
    } else {
      setPreview(null)
    }
  }

  async function apply() {
    if (!dialog) return
    if (dialog.needsReason && !reason.trim()) {
      setError("Reason is required")
      return
    }
    if (dialog.purge) {
      const typed = confirmName.trim()
      if (typed !== facilityName.trim() && typed !== facilityId) {
        setError("Type the facility name or ID exactly to confirm purge")
        return
      }
      if (!ack) {
        setError("Acknowledge the irreversible impact")
        return
      }
      if (!/^\d{6}$/.test(mfaCode.trim())) {
        setError("Enter the 6-digit authenticator code from your recent sign-in")
        return
      }
    }
    setBusy(true)
    setError(null)
    if (dialog.purge) {
      const step = await fetch("/api/platform/mfa/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim() }),
      })
      if (!step.ok) {
        const stepData = await step.json().catch(() => ({}))
        setBusy(false)
        setError(stepData.error ?? "Authenticator verification failed")
        return
      }
    }
    const res = await fetch(`/api/platform/facilities/${facilityId}/lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: dialog.action,
        reason: reason.trim() || undefined,
        typedConfirmation: dialog.purge ? confirmName.trim() : undefined,
        acknowledged: dialog.purge ? ack : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setPreview(data.preview ?? null)
      setError(data.error ?? (data.preview?.blockers?.[0] as string) ?? "Lifecycle action failed")
      return
    }
    setMessage(`${dialog.label} completed`)
    setDialog(null)
    setPreview(data.preview ?? null)
    await load()
  }

  function onDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault()
      setDialog(null)
    }
  }

  const state = snapshot?.currentState ?? "…"

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5" aria-labelledby="lifecycle-heading">
      <h2 id="lifecycle-heading" className="mb-3 text-sm font-semibold text-slate-200">
        Lifecycle control
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        Current state:{" "}
        <span className="font-mono text-[#E8B84B]" aria-live="polite">
          {state}
        </span>
      </p>
      {snapshot ? (
        <ul className="mb-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
          <li>Patients: {snapshot.counts.patients}</li>
          <li>Encounters: {snapshot.counts.encounters}</li>
          <li>Prescriptions: {snapshot.counts.prescriptions ?? 0}</li>
          <li>Lab orders: {snapshot.counts.labOrders ?? 0}</li>
          <li>Invoices: {snapshot.counts.invoices}</li>
          <li>Payments: {snapshot.counts.payments ?? 0}</li>
          <li>Audit events: {snapshot.counts.auditEvents ?? 0}</li>
          <li>Active memberships: {snapshot.counts.memberships ?? snapshot.counts.staffExclusive}</li>
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lifecycle actions">
        {ACTIONS.map((action) => (
          <button
            key={action.action}
            type="button"
            className={`rounded-lg border px-3 py-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8B84B] ${
              action.destructive
                ? "border-red-500/40 text-red-300 hover:bg-red-500/10"
                : "border-slate-700 text-slate-200 hover:border-[#E8B84B]/40"
            }`}
            onClick={(e) => void openAction(action, e)}
          >
            {action.label}
          </button>
        ))}
      </div>
      {message ? (
        <p className="mt-3 text-xs text-green-400" role="status">
          {message}
        </p>
      ) : null}
      {error && !dialog ? (
        <p className="mt-3 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        className="w-[min(100%,28rem)] rounded-2xl border border-slate-700 bg-slate-950 p-0 text-slate-100 shadow-xl backdrop:bg-black/60"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onDialogKeyDown}
        onClose={() => setDialog(null)}
      >
        {dialog ? (
          <div className="space-y-4 p-5">
            <h3 id={titleId} className="text-lg font-semibold">
              {dialog.label}
            </h3>
            <p id={descId} className="text-sm text-slate-400">
              {dialog.purge
                ? "Permanent purge is synthetic/test only and blocked when clinical or financial history exists."
                : "This changes facility operational access. Provide a reason for audit."}
            </p>
            {preview ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300">
                <p>
                  Patients {preview.counts.patients} · Encounters {preview.counts.encounters} · Prescriptions{" "}
                  {preview.counts.prescriptions ?? 0} · Lab {preview.counts.labOrders ?? 0} · Invoices{" "}
                  {preview.counts.invoices} · Payments {preview.counts.payments ?? 0} · Audit{" "}
                  {preview.counts.auditEvents ?? 0}
                </p>
                {preview.blockers.length > 0 ? (
                  <ul className="mt-2 list-disc pl-4 text-amber-300">
                    {preview.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {dialog.needsReason ? (
              <label className="block text-sm">
                <span className="mb-1 block text-slate-400">Reason (required)</span>
                <textarea
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </label>
            ) : null}
            {dialog.purge ? (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-400">Type facility name to confirm</span>
                  <input
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1" />
                  <span>I understand this permanently removes a synthetic facility with no protected history.</span>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate-400">Authenticator code (required)</span>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                  />
                </label>
              </>
            ) : null}
            {error ? (
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm"
                onClick={() => setDialog(null)}
                autoFocus={!dialog.destructive}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                  dialog.destructive ? "bg-red-600 text-white" : "bg-[#E8B84B] text-slate-950"
                }`}
                onClick={() => void apply()}
                disabled={busy}
              >
                {busy ? "Working…" : dialog.label}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  )
}
