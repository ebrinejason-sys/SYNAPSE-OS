"use client"

import { useState } from "react"
import { usePharmacySession } from "@/hooks/use-pharmacy-session"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "At least 8 characters"
  if (!/[A-Z]/.test(pw)) return "Include at least one uppercase letter"
  if (!/[0-9]/.test(pw)) return "Include at least one number"
  if (!/[^A-Za-z0-9]/.test(pw)) return "Include at least one special character"
  return null
}

export default function ProfilePage() {
  const { user } = usePharmacySession()
  const { toast } = useToast()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)

  const displayName = user?.fullName ?? user?.email ?? "User"
  const roleLabel = user?.pharmacyRole?.replace("pharmacy_", "").toUpperCase() ?? "STAFF"

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords do not match" })
      return
    }
    const err = validatePassword(newPassword)
    if (err) {
      toast({ variant: "destructive", title: err })
      return
    }

    setPasswordLoading(true)
    try {
      const res = await fetch("/api/auth/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to change password")
      toast({ title: "Password changed successfully" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your personal information and account security.</p>
      </div>

      {/* Account Info */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-primary">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{roleLabel} · {user?.email}</p>
          </div>
        </div>
        <dl className="space-y-3 text-sm border-t border-border pt-4">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Full name</dt>
            <dd className="font-medium text-foreground">{displayName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium text-foreground">{roleLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Account type</dt>
            <dd className="font-medium text-foreground">{user?.isAdmin ? "Admin" : "Staff"}</dd>
          </div>
        </dl>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-1">Change Password</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Must be at least 8 characters with an uppercase letter, number, and special character.
        </p>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-medium text-foreground mb-1">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-xs font-medium text-foreground mb-1">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-foreground mb-1">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            type="submit"
            disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {passwordLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {passwordLoading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  )
}
