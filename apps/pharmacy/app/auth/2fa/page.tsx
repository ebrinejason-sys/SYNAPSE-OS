"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Step = "loading" | "setup" | "verify"

function TwoFactorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/portal/dashboard"
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep] = useState<Step>("loading")
  const [factorId, setFactorId] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [qrCode, setQrCode] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    async function prepareMfa() {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === "aal2") {
        router.replace(next)
        return
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) {
        if (mounted) {
          setError("Could not load your two-factor settings.")
          setStep("verify")
        }
        return
      }

      const verifiedTotp = factors?.totp?.find((factor) => factor.status === "verified")
      if (verifiedTotp) {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: verifiedTotp.id,
        })
        if (challengeError || !challenge) {
          if (mounted) {
            setError("Could not start two-factor verification.")
            setStep("verify")
          }
          return
        }
        if (mounted) {
          setFactorId(verifiedTotp.id)
          setChallengeId(challenge.id)
          setStep("verify")
        }
        return
      }

      const { data: enrollment, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Synapse Pharmacy",
      })
      if (enrollError || !enrollment) {
        if (mounted) {
          setError("Could not create your authenticator setup.")
          setStep("setup")
        }
        return
      }

      if (mounted) {
        setFactorId(enrollment.id)
        setQrCode(enrollment.totp.qr_code)
        setStep("setup")
      }
    }

    prepareMfa()

    return () => {
      mounted = false
    }
  }, [next, router, supabase])

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    if (code.length !== 6 || !factorId) {
      setError("Enter the 6-digit code from your authenticator app.")
      return
    }

    setIsLoading(true)
    setError(null)

    let activeChallengeId = challengeId
    if (!activeChallengeId) {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError || !challenge) {
        setError("Could not start two-factor verification.")
        setIsLoading(false)
        return
      }
      activeChallengeId = challenge.id
      setChallengeId(challenge.id)
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: activeChallengeId,
      code,
    })

    if (verifyError) {
      setError("Incorrect code. Try again.")
      setIsLoading(false)
      return
    }

    router.replace(next)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#07070A]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg bg-gradient-to-br from-[#F97316] to-[#E8B84B]">
            <span className="text-white font-black text-2xl tracking-tight">S</span>
          </div>
          <h1 className="text-xl font-bold text-white">Two-factor authentication</h1>
          <p className="text-sm mt-1 text-center text-zinc-400">
            Protect admin access with a 6-digit authenticator code.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#111117] p-6 shadow-xl">
          {step === "loading" ? (
            <div className="space-y-3">
              <div className="h-4 w-3/4 rounded bg-zinc-800" />
              <div className="h-10 rounded bg-zinc-800" />
              <div className="h-10 rounded bg-zinc-800" />
            </div>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              {step === "setup" && qrCode && (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-zinc-300">
                    Scan this QR code with Google Authenticator, Microsoft Authenticator, or a compatible TOTP app.
                  </p>
                  <div className="rounded-xl bg-white p-3">
                    <img src={qrCode} alt="Two-factor setup QR code" className="w-full" />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="mfa-code"
                  className="text-xs font-medium uppercase tracking-wider text-zinc-400"
                >
                  Authenticator code
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    setError(null)
                  }}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className="synapse-input text-center font-mono text-xl tracking-[0.3em]"
                />
              </div>

              {error && (
                <p className="text-sm rounded-lg px-3 py-2 text-red-400 bg-red-500/10">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="btn-primary w-full h-11"
              >
                {isLoading ? "Verifying..." : step === "setup" ? "Enable 2FA" : "Verify"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TwoFactorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#07070A]">
          <div className="h-10 w-48 rounded bg-zinc-800" />
        </div>
      }
    >
      <TwoFactorContent />
    </Suspense>
  )
}
