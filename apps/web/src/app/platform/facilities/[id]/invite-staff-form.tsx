"use client"

import { useState } from "react"

type Department = { id?: string; name?: string | null }

export function InviteStaffForm({ tenantId, departments }: { tenantId: string; departments: Department[] }) {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(formData: FormData) {
    setBusy(true); setMessage(null)
    const response = await fetch(`/api/platform/facilities/${tenantId}/staff`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData)) })
    const data = await response.json() as { error?: string; inviteUrl?: string }
    setMessage(response.ok ? `Invitation created: ${data.inviteUrl ?? "email queued"}` : data.error ?? "Invitation failed")
    setBusy(false)
  }
  return <form action={submit} className="mt-4 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-2">
    <label className="text-sm text-slate-400">Full name<input name="fullName" required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" /></label>
    <label className="text-sm text-slate-400">Email<input name="email" type="email" required className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" /></label>
    <label className="text-sm text-slate-400">Phone (optional)<input name="phone" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" /></label>
    <label className="text-sm text-slate-400">Role<select name="role" defaultValue="lab_technician" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"><option value="lab_admin">Laboratory Administrator</option><option value="lab_technician">Lab Technician</option><option value="lab_scientist">Lab Scientist / Verifier</option><option value="billing_officer">Billing Officer</option></select></label>
    <label className="text-sm text-slate-400 sm:col-span-2">Primary section<select name="departmentId" defaultValue="" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"><option value="">Unassigned</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
    <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-[#07070A] sm:col-span-2">{busy ? "Creating invitation..." : "Invite staff"}</button>
    {message ? <p role="status" className="text-xs text-slate-300 sm:col-span-2">{message}</p> : null}
  </form>
}
