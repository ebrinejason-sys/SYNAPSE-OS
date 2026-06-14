"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, KeyRound } from "lucide-react";
import { SynapseLogo } from "../../../components/SynapseLogo";

type LoginStep = "credentials" | "otp";

export default function PlatformLoginPage() {
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
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

    const data = await res.json().catch(() => ({})) as {
      otpSent?: boolean;
      mfaRequired?: boolean;
      error?: string;
    };

    if (!res.ok) {
      setError(data.error ?? "Access denied. Check your credentials.");
      setLoading(false);
      return;
    }

    if (data.mfaRequired) {
      router.push("/platform/mfa-verify");
      return;
    }

    setStep("otp");
    setLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/email-otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });

    const data = await res.json().catch(() => ({})) as {
      ok?: boolean;
      mfaRequired?: boolean;
      mfaSetupRequired?: boolean;
      error?: string;
    };

    if (!res.ok) {
      setError(data.error ?? "Verification failed. Try again.");
      setLoading(false);
      return;
    }

    if (data.mfaSetupRequired) {
      router.push("/platform/mfa");
      return;
    }
    if (data.mfaRequired) {
      router.push("/platform/mfa-verify");
      return;
    }

    router.push("/platform");
    router.refresh();
  }

  async function handleResend() {
    setResendMsg(null);
    setError(null);
    const res = await fetch("/api/auth/email-otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setResendMsg("A new code was sent to your email.");
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Could not resend code.");
    }
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
              : `Enter the verification code sent to ${email}.`}
          </p>
        </div>

        {step === "credentials" && (
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
              {loading ? "Checking..." : "Continue"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#111117] p-4">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#E8B84B]" />
              <p className="text-sm text-slate-300">
                A 6-digit code was sent to{" "}
                <span className="text-white font-medium">{email}</span>. It expires in 10 minutes.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <KeyRound className="h-3.5 w-3.5 shrink-0" />
              Enter the code from your inbox
            </div>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full bg-[#111117] border border-slate-700 rounded-xl px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-white focus:outline-none focus:border-[#E8B84B]"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {resendMsg && <p className="text-green-400 text-sm">{resendMsg}</p>}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-[#F97316] text-[#07070A] font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                onClick={() => { setStep("credentials"); setOtp(""); setError(null); setResendMsg(null); }}
                className="hover:text-white"
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
