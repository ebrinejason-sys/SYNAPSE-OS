"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { SynapseLogo } from "../../../components/SynapseLogo";

export default function PlatformLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const totpValue = totp.join("");

  function updateTotp(index: number, value: string) {
    const cleaned = value.replace(/[^0-9]/g, "").slice(0, 1);
    setTotp((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (totpValue.length !== 6) {
      setError("Enter the full 6-digit TOTP code.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Access denied.");
      setLoading(false);
      return;
    }
    router.push("/platform");
  }

  return (
    <div className="min-h-screen bg-[#07070A] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/70 p-6 sm:p-8">
        <div className="flex justify-center mb-8">
          <SynapseLogo size="lg" />
        </div>
        <h1 className="text-xl font-bold mb-1">System Administration</h1>
        <p className="text-slate-400 text-sm mb-6">Email, password, and TOTP are required.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-[#0D1B2E] border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00D4AA] text-white"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-[#0D1B2E] border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00D4AA] text-white"
          />

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">TOTP code</p>
            <div className="grid grid-cols-6 gap-2">
              {totp.map((digit, index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => updateTotp(index, e.target.value)}
                  className="h-11 rounded-lg border border-slate-700 bg-[#0D1B2E] text-center text-lg font-semibold text-white focus:border-[#E8B84B] focus:outline-none"
                  aria-label={`TOTP digit ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F97316] text-[#07070A] font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {loading ? "..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
