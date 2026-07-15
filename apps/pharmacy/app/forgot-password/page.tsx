"use client"

import { useState } from "react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      // Always show success to avoid leaking whether the email exists
      setSubmitted(true)
    } catch {
      setError("Could not send reset email. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#07070A]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="SynapseOS" className="w-16 h-16 rounded-2xl object-contain mb-4 shadow-lg" />
          <h1 className="text-xl font-bold text-white">
            Synapse <span className="text-[#E8B84B]">Pharmacy</span>
          </h1>
          <p className="text-sm mt-1 text-zinc-400">Password Reset</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#111117] p-6 shadow-xl">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-medium">Check your email</p>
              <p className="text-sm text-zinc-400">
                If <span className="text-zinc-200">{email}</span> is registered, you will receive a password reset link shortly. The link expires in 1 hour.
              </p>
              <Link href="/login" className="block text-sm text-[#E8B84B] hover:text-[#F97316] mt-2">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-zinc-400 mb-2">
                Enter your work email and we will send you a link to reset your password.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@synapseos.tech"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="synapse-input"
                />
              </div>

              {error && (
                <p className="text-sm rounded-lg px-3 py-2 text-red-400 bg-red-500/10">{error}</p>
              )}

              <button type="submit" disabled={isLoading} className="btn-primary w-full h-11 mt-2">
                {isLoading ? "Sending…" : "Send Reset Link"}
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
