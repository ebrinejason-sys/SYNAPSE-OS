"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import { SynapseLogo } from "../../../../components/SynapseLogo";

export default function PortalLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Invalid credentials. Check your email and password.");
      setLoading(false);
      return;
    }
    const { slug } = await params;
    router.push(`/os/${slug}/dashboard`);
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold mb-2">Staff Sign In</h1>
        <p className="text-slate-400 text-sm mb-6">Access your hospital portal</p>
        <form onSubmit={handleLogin} className="space-y-4">
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
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
