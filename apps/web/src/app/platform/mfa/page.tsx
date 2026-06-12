"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Smartphone, CheckCircle, Copy } from "lucide-react";
import { SynapseLogo } from "../../../components/SynapseLogo";

type Step = "loading" | "idle" | "enrolling" | "done";

export default function PlatformMfaPage() {
  const [step, setStep]     = useState<Step>("loading");
  const [uri,  setUri]      = useState("");
  const [secret, setSecret] = useState("");
  const [code,   setCode]   = useState("");
  const [error,  setError]  = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Start enrollment immediately on mount — server reads the MFA pending cookie
    startEnrollment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnrollment() {
    setLoading(true);
    const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
    if (res.status === 401) {
      router.replace("/platform/login");
      return;
    }
    if (!res.ok) {
      setError("Could not start authenticator setup. Please try logging in again.");
      setStep("idle");
      setLoading(false);
      return;
    }
    const data = await res.json() as { uri: string; secret: string };
    setUri(data.uri);
    setSecret(data.secret);
    setStep("enrolling");
    setLoading(false);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError("Enter the 6-digit code from your authenticator app."); return; }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/mfa/verify-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? "Verification failed. Try again.");
      if (res.status === 401) router.replace("/platform/login");
      setLoading(false);
      return;
    }

    setStep("done");
    setLoading(false);
  }

  const qrImageUrl = uri
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(uri)}&size=200x200&margin=8`
    : "";

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
              Mandatory MFA
            </div>
            <h1 className="text-xl font-bold">Set up platform authenticator</h1>
            <p className="mt-1 text-sm text-slate-400">
              Platform admin accounts require a TOTP authenticator app (Google Authenticator, Authy).
            </p>
          </div>

          {step === "loading" && (
            <p className="text-sm text-slate-400">Preparing authenticator setup&hellip;</p>
          )}

          {step === "idle" && (
            <div className="space-y-4">
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="button"
                onClick={startEnrollment}
                disabled={loading}
                className="w-full rounded-xl bg-[#F97316] py-3 text-sm font-bold text-[#07070A] disabled:opacity-50"
              >
                {loading ? "Starting…" : "Start Setup"}
              </button>
            </div>
          )}

          {step === "enrolling" && (
            <form onSubmit={verifyCode} className="space-y-5">
              <div className="rounded-xl border border-slate-800 bg-[#111117] p-5 text-center">
                <p className="mb-3 text-sm font-semibold">1. Scan with your authenticator app</p>
                {qrImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrImageUrl} alt="TOTP QR code" width={200} height={200}
                    className="mx-auto mb-3 rounded-xl bg-white p-2" />
                )}
                <p className="mb-1 text-xs text-slate-500">Or enter this secret manually</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="break-all rounded-lg bg-[#E8B84B]/10 px-3 py-2 text-xs tracking-wide text-[#E8B84B]">
                    {secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(secret)}
                    className="shrink-0 text-slate-500 hover:text-slate-300"
                    title="Copy secret"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">2. Enter the 6-digit code to activate</p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className="w-full rounded-xl border border-slate-700 bg-[#111117] px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-white outline-none focus:border-[#E8B84B]"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full rounded-xl bg-[#F97316] py-3 text-sm font-bold text-[#07070A] disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Activate Authenticator"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Authenticator activated</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Your platform account is now protected with multi-factor authentication.
                </p>
              </div>
              <a
                href="/platform"
                className="block rounded-xl bg-[#F97316] py-3 text-sm font-bold text-[#07070A]"
              >
                Open Platform Dashboard
              </a>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Use Google Authenticator, Authy, or any TOTP-compatible app.</span>
          </div>
        </section>
      </main>
    </div>
  );
}
