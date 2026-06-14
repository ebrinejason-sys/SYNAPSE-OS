"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { SynapseLogo } from "../../../components/SynapseLogo";

export default function PlatformMfaVerifyPage() {
  const [code,  setCode]    = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkEnrollment() {
      const res = await fetch("/api/auth/mfa/status");
      if (res.status === 401) { router.replace("/platform/login"); return; }
      const data = await res.json() as { enrolled?: boolean };
      if (!data.enrolled) {
        router.replace("/platform/mfa");
        return;
      }
      setChecking(false);
    }
    checkEnrollment();
  }, [router]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      const msg = d.error ?? "Verification failed."
      // Only hard-redirect for expired/invalid session — not for a wrong code
      const isSessionError = res.status === 401 &&
        (msg.toLowerCase().includes('session') || msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('log in again'))
      if (isSessionError) { window.location.href = "/platform/login"; return; }
      setError(msg);
      setLoading(false);
      return;
    }

    window.location.href = "/platform";
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#07070A] flex items-center justify-center text-white">
        <p className="text-sm text-slate-400">Checking authenticator status…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070A] px-4 py-8 text-white">
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex justify-center">
          <SynapseLogo size="lg" />
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-xl sm:p-8">
          <div className="mb-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E8B84B]/25 bg-[#E8B84B]/10 px-3 py-1 text-xs font-semibold text-[#E8B84B]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Two-Factor Authentication
            </div>
            <h1 className="text-xl font-bold">Enter authenticator code</h1>
            <p className="mt-1 text-sm text-slate-400">
              Open your authenticator app and enter the 6-digit code for Synapse OS.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              autoFocus
              autoComplete="one-time-code"
              className="w-full rounded-xl border border-slate-700 bg-[#111117] px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-white outline-none focus:border-[#E8B84B]"
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-xl bg-[#F97316] py-3 text-sm font-bold text-[#07070A] disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500">
            Code expires every 30 seconds. If it&apos;s about to expire, wait for a fresh one.
          </p>

          <div className="mt-4 border-t border-slate-800 pt-4">
            <a href="/platform/login" className="text-xs text-slate-500 hover:text-slate-300">
              ← Back to login
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
