"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail } from "lucide-react"

type LoginStep = "credentials" | "otp"

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>("credentials")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  const router = useRouter()

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Invalid email or password.')
      setIsLoading(false)
      return
    }

    setStep("otp")
    setIsLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const res = await fetch('/api/auth/otp-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Verification failed. Try again.')
      setIsLoading(false)
      return
    }

    router.push("/portal/dashboard")
    router.refresh()
  }

  const handleResend = async () => {
    setResendMsg(null)
    setError(null)
    const res = await fetch('/api/auth/otp-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (res.ok) {
      setResendMsg("A new code was sent to your email.")
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string }
      setError(data.error ?? "Could not resend code.")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#07070A]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Synapse Pharmacy" className="w-16 h-16 rounded-2xl object-contain mb-4 shadow-lg" />
          <h1 className="text-xl font-bold text-white">
            Synapse <span className="text-[#E8B84B]">Pharmacy</span>
          </h1>
          <p className="text-sm mt-1 text-zinc-400">
            {step === "credentials" ? "Staff & Admin Portal" : `Code sent to ${email}`}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-[#111117] p-6 shadow-xl">
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-medium uppercase tracking-wider text-zinc-400"
                >
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

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-medium uppercase tracking-wider text-zinc-400"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="synapse-input"
                />
              </div>

              {error && (
                <p className="text-sm rounded-lg px-3 py-2 text-red-400 bg-red-500/10">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full h-11 mt-2"
              >
                {isLoading ? "Checking…" : "Continue"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-zinc-700 bg-zinc-900/50 p-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#E8B84B]" />
                <p className="text-sm text-zinc-300">
                  A 6-digit code was sent to{" "}
                  <span className="text-white font-medium">{email}</span>. Expires in 10 minutes.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoFocus
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  disabled={isLoading}
                  className="synapse-input text-center font-mono text-xl tracking-[0.3em]"
                />
              </div>

              {error && (
                <p className="text-sm rounded-lg px-3 py-2 text-red-400 bg-red-500/10">
                  {error}
                </p>
              )}
              {resendMsg && (
                <p className="text-sm text-green-400">{resendMsg}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="btn-primary w-full h-11 mt-2"
              >
                {isLoading ? "Verifying…" : "Verify & Sign In"}
              </button>

              <div className="flex items-center justify-between text-xs text-zinc-600 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setOtp(""); setError(null); setResendMsg(null) }}
                  className="hover:text-zinc-300"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-[#E8B84B] hover:text-[#F97316]"
                >
                  Resend code
                </button>
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
