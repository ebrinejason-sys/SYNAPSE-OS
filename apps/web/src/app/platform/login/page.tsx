"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, KeyRound } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { SynapseLogo } from "../../../components/SynapseLogo";

type LoginStep = "credentials" | "totp" | "magic_sent";
type LoginMode = "password" | "magic";

export default function PlatformLoginPage() {
  const [step, setStep] = useState<LoginStep>("credentials");
  const [mode, setMode] = useState<LoginMode>("password");
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

    const res = await fetch("/api/auth/password-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Access denied. Check your credentials.");
      setLoading(false);
      return;
    }

    router.push("/platform");
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/platform/mfa`,
      },
    });

    if (otpError) {
      setError("Could not send login link. Make sure this email is registered.");
      setLoading(false);
      return;
    }

    setStep("magic_sent");
    setLoading(false);
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/platform/mfa`,
      },
    });
  }

  async function afterSignIn(supabase: ReturnType<typeof createClient>) {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");

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
            {step === "credentials" && "Sign in with your platform admin account."}
            {step === "totp" && "Verify with your authenticator app."}
            {step === "magic_sent" && "Check your email for the sign-in link."}
          </p>
        </div>

        {step === "credentials" && (
          <div className="space-y-4">
            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-[#111117] py-3 text-sm font-semibold hover:border-[#F97316]/40 hover:bg-[#F97316]/5 transition-all disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-slate-800" />
              <span className="text-xs text-slate-500">or</span>
              <div className="flex-1 border-t border-slate-800" />
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-slate-800 p-0.5 bg-[#111117]">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${mode === "password" ? "bg-[#F97316] text-[#07070A]" : "text-slate-400 hover:text-white"}`}
              >
                <KeyRound className="h-3 w-3" /> Password
              </button>
              <button
                type="button"
                onClick={() => setMode("magic")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${mode === "magic" ? "bg-[#F97316] text-[#07070A]" : "text-slate-400 hover:text-white"}`}
              >
                <Mail className="h-3 w-3" /> Magic Link
              </button>
            </div>

            {mode === "password" ? (
              <form onSubmit={handleCredentials} className="space-y-3">
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
                  {loading ? "Checking..." : "Sign In"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  className="w-full bg-[#111117] border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#F97316] text-white"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#F97316] text-[#07070A] font-bold py-3 rounded-xl disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Login Link"}
                </button>
              </form>
            )}
          </div>
        )}

        {step === "totp" && (
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
              onClick={() => { setStep("credentials"); setTotpCode(""); setError(null); }}
              className="w-full text-sm text-slate-400 hover:text-white"
            >
              Use a different account
            </button>
          </form>
        )}

        {step === "magic_sent" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F97316]/10">
              <Mail className="h-8 w-8 text-[#F97316]" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Check your inbox</h2>
              <p className="mt-1 text-sm text-slate-400">
                A sign-in link was sent to <span className="text-white font-medium">{email}</span>.
                Click it to open the platform.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setStep("credentials"); setError(null); }}
              className="text-sm text-[#E8B84B] hover:text-[#F97316]"
            >
              Use a different method
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          Need to set up authenticator?{" "}
          <a href="/platform/mfa" className="text-[#E8B84B] hover:text-[#F97316]">
            Set up MFA
          </a>
        </p>
      </div>
    </div>
  );
}
