"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { SynapseLogo } from "../../../../components/SynapseLogo";

type LoginStep = "credentials" | "otp";

export default function PortalLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Invalid credentials. Check your email and password.");
      setLoading(false);
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

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Verification failed. Try again.");
      setLoading(false);
      return;
    }

    const { slug } = await params;
    router.push(`/os/${slug}/dashboard`);
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
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <SynapseLogo size="md" />
        </div>

        <h1 className="text-xl font-bold mb-1 text-center">
          {step === "credentials" ? "Staff Sign In" : "Verify Your Identity"}
        </h1>
        <p className="text-slate-400 text-sm mb-6 text-center">
          {step === "credentials"
            ? "Access your hospital portal"
            : `Enter the code sent to ${email}`}
        </p>

        {step === "credentials" && (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-[#0D1B2E] border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00D4AA]"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-[#0D1B2E] border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00D4AA]"
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00D4AA] text-[#060D1A] font-bold py-3 rounded-xl disabled:opacity-50"
            >
              {loading ? "Checking..." : "Continue"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-[#0D1B2E] p-4">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#00D4AA]" />
              <p className="text-sm text-slate-300">
                A 6-digit code was sent to{" "}
                <span className="text-white font-medium">{email}</span>. It expires in 10 minutes.
              </p>
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
              className="w-full bg-[#0D1B2E] border border-slate-700 rounded-xl px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] focus:outline-none focus:border-[#00D4AA]"
            />

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                {error}
              </p>
            )}
            {resendMsg && <p className="text-green-400 text-sm text-center">{resendMsg}</p>}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-[#00D4AA] text-[#060D1A] font-bold py-3 rounded-xl disabled:opacity-50"
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
                className="text-[#00D4AA] hover:text-white"
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
