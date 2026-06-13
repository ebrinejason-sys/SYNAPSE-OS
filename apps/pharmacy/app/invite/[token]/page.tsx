"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { getInviteDetails, setupAccount } from "./actions"

type PageState = "loading" | "invalid" | "already_used" | "valid" | "submitting" | "success"

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const token = typeof params.token === "string" ? params.token : Array.isArray(params.token) ? params.token[0] : ""

  const [pageState, setPageState] = useState<PageState>("loading")
  const [pharmacyName, setPharmacyName] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setPageState("invalid")
      return
    }

    const checkToken = async () => {
      const details = await getInviteDetails(token)

      if (details.status === "already_used") {
        setPageState("already_used")
        return
      }

      if (details.status !== "valid") {
        setPageState("invalid")
        return
      }

      setPharmacyName(details.pharmacyName)
      setPageState("valid")
    }

    checkToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (fullName.trim().length < 2) {
      setError("Please enter your full name.")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setPageState("submitting")

    const result = await setupAccount(token, fullName.trim(), password)

    if (!result.success) {
      setError(result.error ?? "An unexpected error occurred.")
      setPageState("valid")
      return
    }

    setPageState("success")
    router.push("/onboarding")
    router.refresh()
  }

  // ── Logo ──────────────────────────────────────────────────────────────────
  const Logo = () => (
    <div className="flex flex-col items-center mb-8">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg bg-gradient-to-br from-[#F97316] to-[#E8B84B]">
        <span className="text-white font-black text-2xl tracking-tight">S</span>
      </div>
      <h1 className="text-xl font-bold text-white">
        Synapse <span className="text-[#E8B84B]">Pharmacy</span>
      </h1>
    </div>
  )

  // ── Loading ───────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Verifying invite link…</p>
        </div>
      </div>
    )
  }

  // ── Invalid / Expired ─────────────────────────────────────────────────────
  if (pageState === "invalid") {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center p-4">
        <div className="bg-[#111117] border border-[#2A2A36] rounded-2xl p-8 w-full max-w-md shadow-xl text-center">
          <Logo />
          <div className="text-red-400 bg-red-500/10 rounded-lg px-4 py-4 text-sm">
            <p className="font-semibold text-base mb-1">Link invalid or expired</p>
            <p className="text-red-300/80">This invite link is invalid or has expired. Contact your administrator to request a new one.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Already used ──────────────────────────────────────────────────────────
  if (pageState === "already_used") {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center p-4">
        <div className="bg-[#111117] border border-[#2A2A36] rounded-2xl p-8 w-full max-w-md shadow-xl text-center">
          <Logo />
          <div className="text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-4 text-sm">
            <p className="font-semibold text-base mb-1">Invite already used</p>
            <p className="text-blue-200/80">This invite has already been used. Contact your administrator if you need help accessing your account.</p>
          </div>
          <p className="mt-6 text-sm text-zinc-500">
            Already have an account?{" "}
            <a href="/login" className="text-[#F97316] hover:underline font-medium">
              Sign in
            </a>
          </p>
        </div>
      </div>
    )
  }

  // ── Valid form (and submitting / success) ─────────────────────────────────
  return (
    <div className="min-h-screen bg-[#07070A] flex items-center justify-center p-4">
      <div className="bg-[#111117] border border-[#2A2A36] rounded-2xl p-8 w-full max-w-md shadow-xl">
        <Logo />

        <div className="mb-6 text-center">
          <h2 className="text-white font-bold text-xl mb-1">Set up your Synapse Pharmacy account</h2>
          {pharmacyName && (
            <p className="text-[#E8B84B] text-sm font-medium">{pharmacyName}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full name */}
          <div className="space-y-1.5">
            <label htmlFor="fullName" className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              placeholder="Jane Nakato"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={pageState === "submitting"}
              className="w-full bg-[#1A1A24] border border-[#2A2A36] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-[#F97316] focus:outline-none disabled:opacity-50 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={pageState === "submitting"}
                className="w-full bg-[#1A1A24] border border-[#2A2A36] rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 focus:border-[#F97316] focus:outline-none disabled:opacity-50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={pageState === "submitting"}
                className="w-full bg-[#1A1A24] border border-[#2A2A36] rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 focus:border-[#F97316] focus:outline-none disabled:opacity-50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-red-400 bg-red-500/10 rounded-lg px-3 py-2 text-sm">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={pageState === "submitting"}
            className="w-full bg-[#F97316] hover:bg-orange-600 text-white rounded-lg py-2.5 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
          >
            {pageState === "submitting" ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating Account…
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="text-center text-xs mt-6 text-zinc-600">
          Synapse Health Technologies &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
