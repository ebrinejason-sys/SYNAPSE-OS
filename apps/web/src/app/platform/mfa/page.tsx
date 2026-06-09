"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ShieldCheck, Smartphone } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { SynapseLogo } from "../../../components/SynapseLogo";

type Step = "checking" | "idle" | "enrolling" | "done" | "already_enrolled";

export default function PlatformMfaPage() {
  const [step, setStep] = useState<Step>("checking");
  const [qrUrl, setQrUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function checkEnrollment() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/platform/login");
        return;
      }

      setUserEmail(user.email ?? "");
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasTotp = factors?.totp?.some((factor) => factor.status === "verified");
      setStep(hasTotp ? "already_enrolled" : "idle");
    }

    checkEnrollment();
  }, [router]);

  async function startEnrollment() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Synapse Platform Admin",
    });

    if (enrollError || !data) {
      setError(enrollError?.message ?? "Failed to start authenticator setup.");
      setLoading(false);
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: data.id,
    });

    if (challengeError || !challenge) {
      setError(challengeError?.message ?? "Failed to create authenticator challenge.");
      setLoading(false);
      return;
    }

    setQrUrl(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setChallengeId(challenge.id);
    setStep("enrolling");
    setLoading(false);
  }

  async function verifyCode() {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: verifyError } = await createClient().auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });

    if (verifyError) {
      setError("Incorrect authenticator code.");
      setLoading(false);
      return;
    }

    setStep("done");
    setLoading(false);
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
              Mandatory MFA
            </div>
            <h1 className="text-xl font-bold">Platform authenticator</h1>
            <p className="mt-1 text-sm text-slate-400">
              Platform admins must use a Google Authenticator-compatible TOTP app.
            </p>
          </div>

          {step === "checking" && <p className="text-sm text-slate-400">Checking authenticator status...</p>}

          {step === "already_enrolled" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                <div>
                  <p className="text-sm font-semibold text-green-300">Authenticator already set up</p>
                  <p className="mt-1 text-xs text-slate-400">{userEmail} has a verified TOTP factor.</p>
                </div>
              </div>
              <Link href="/platform" className="block rounded-xl bg-[#F97316] py-3 text-center text-sm font-bold text-[#07070A]">
                Open Platform Dashboard
              </Link>
            </div>
          )}

          {step === "idle" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-[#111117] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F97316]/10">
                    <Smartphone className="h-5 w-5 text-[#F97316]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Set up your authenticator</p>
                    <p className="text-xs text-slate-400">Scan a QR code, then enter the generated 6-digit code.</p>
                  </div>
                </div>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="button"
                onClick={startEnrollment}
                disabled={loading}
                className="w-full rounded-xl bg-[#F97316] py-3 text-sm font-bold text-[#07070A] disabled:opacity-50"
              >
                {loading ? "Starting..." : "Start Setup"}
              </button>
            </div>
          )}

          {step === "enrolling" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-800 bg-[#111117] p-5 text-center">
                <p className="mb-3 text-sm font-semibold">Scan with your authenticator app</p>
                {qrUrl && (
                  <div className="mb-3 flex justify-center">
                    <Image
                      src={qrUrl}
                      alt="Platform authenticator QR code"
                      width={184}
                      height={184}
                      unoptimized
                      className="rounded-xl bg-white p-2"
                    />
                  </div>
                )}
                <p className="mb-1 text-xs text-slate-500">Manual secret</p>
                <code className="block break-all rounded-lg bg-[#F97316]/10 px-3 py-2 text-xs tracking-wide text-[#E8B84B]">
                  {secret}
                </code>
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-xl border border-slate-700 bg-[#111117] px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-white outline-none focus:border-[#E8B84B]"
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="button"
                onClick={verifyCode}
                disabled={loading || code.length !== 6}
                className="w-full rounded-xl bg-[#F97316] py-3 text-sm font-bold text-[#07070A] disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify and Activate"}
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Authenticator activated</h2>
                <p className="mt-1 text-sm text-slate-400">Your platform account now satisfies the MFA requirement.</p>
              </div>
              <Link href="/platform" className="block rounded-xl bg-[#F97316] py-3 text-sm font-bold text-[#07070A]">
                Open Platform Dashboard
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
