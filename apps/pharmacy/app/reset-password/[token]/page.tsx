"use client"

import { useState } from "react"
import Link from "next/link"

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters"
  if (!/[A-Z]/.test(password)) return "Include at least one uppercase letter"
  if (!/[0-9]/.test(password)) return "Include at least one number"
  if (!/[^A-Za-z0-9]/.test(password)) return "Include at least one special character (e.g. @ # !)"
  return null
}

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    const strengthError = validatePassword(newPassword)
    if (strengthError) {
      setError(strengthError)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Failed to reset password. The link may have expired.")
      } else {
        setSuccess(true)
      }
    } catch {
      setError("Could not reach the server. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#07070A]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-dark.png" alt="Synapse Pharmacy" className="w-16 h-16 rounded-2xl object-contain mb-4 shadow-lg" />
          <h1 className="text-xl font-bold text-white">
            Synapse <span className="text-[#E8B84B]">Pharmacy</span>
          </h1>
          <p className="text-sm mt-1 text-zinc-400">Set New Password</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#111117] p-6 shadow-xl">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-medium">Password updated</p>
              <p className="text-sm text-zinc-400">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <Link href="/login" className="btn-primary block text-center h-11 leading-[44px]">
                Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="newPassword" className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="synapse-input"
                />
                <p className="text-xs text-zinc-600">
                  At least 8 characters, one uppercase, one number, one special character.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="synapse-input"
                />
              </div>

              {error && (
                <p className="text-sm rounded-lg px-3 py-2 text-red-400 bg-red-500/10">{error}</p>
              )}

              <button type="submit" disabled={isLoading} className="btn-primary w-full h-11 mt-2">
                {isLoading ? "Updating…" : "Set New Password"}
              </button>

              <div className="text-center pt-1">
                <Link href="/login" className="text-xs text-zinc-600 hover:text-zinc-300">
                  ← Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-6 text-zinc-600">
          Synapse Health Technologies &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
