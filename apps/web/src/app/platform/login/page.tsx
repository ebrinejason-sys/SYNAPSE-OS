"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { SynapseLogo } from "../../../components/SynapseLogo";

type LoginStep = "credentials" | "totp";

export default function PlatformLoginPage() {
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Access denied.");
      setLoading(false);
      return;
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setError("Could not load authenticator settings.");
      setLoading(false);
      return;
    }

    const verifiedTotp = factors?.totp?.find((factor) => factor.status === "verified");
    if (!verifiedTotp) {
      router.push("/platform/mfa");
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") {
      router.push("/platform");
      router.refresh();
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: verifiedTotp.id,
    });

    if (challengeError || !challenge) {
      setError("Could not start authenticator verification.");
      setLoading(false);
      return;
    }

    setFactorId(verifiedTotp.id);
    setChallengeId(challenge.id);
    setStep("totp");
    setLoading(false);
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    if (totpCode.length !== 6) {
      setError("Enter the full 6-digit authenticator code.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: verifyError } = await createClient().auth.mfa.verify({
      factorId,
      challengeId,
      code: totpCode,
    });

    if (verifyError) {
      setError("Incorrect authenticator code.");
      setLoading(false);
      return;
    }

    router.push("/platform");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#07070A] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/70 p-6 sm:p-8">
        <div className="flex justify-center mb-8">
          <SynapseLogo size="lg" />
        </div>

        <div className="mb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E8B84B]/25 bg-[#E8B84B]/10 px-3 py-1 text-xs font-semibold text-[#E8B84B]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Platform Control Center
          </div>
          <h1 className="text-xl font-bold">System Administration</h1>
          <p className="mt-1 text-slate-400 text-sm">
            {step === "credentials"
              ? "Sign in with your platform admin account."
              : "Verify with your authenticator app."}
          </p>
        </div>

        {step === "credentials" ? (
          <form onSubmit={handleCredentials} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full bg-[#111117] border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#F97316] text-white"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full bg-[#111117] border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#F97316] text-white"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F97316] text-[#07070A] font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? "Checking..." : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotp} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-xl border border-slate-700 bg-[#111117] px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-white outline-none focus:border-[#E8B84B]"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full bg-[#F97316] text-[#07070A] font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Open Platform"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setTotpCode("");
                setError(null);
              }}
              className="w-full text-sm text-slate-400 hover:text-white"
            >
              Use a different account
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          First time here?{" "}
          <Link href="/platform/mfa" className="text-[#E8B84B] hover:text-[#F97316]">
            Set up your authenticator
          </Link>
        </p>
      </div>
    </div>
  );
}
