"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Invalid email or password.')
      setIsLoading(false)
      return
    }

    router.push("/portal/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#07070A]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg bg-gradient-to-br from-[#F97316] to-[#E8B84B]">
            <span className="text-white font-black text-2xl tracking-tight">S</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            Synapse <span className="text-[#E8B84B]">Pharmacy</span>
          </h1>
          <p className="text-sm mt-1 text-zinc-400">Staff &amp; Admin Portal</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-800 bg-[#111117] p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium uppercase tracking-wider text-zinc-400"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@synapseos.tech"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="synapse-input"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wider text-zinc-400"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="synapse-input"
              />
            </div>

            {error && (
              <p className="text-sm rounded-lg px-3 py-2 text-red-400 bg-red-500/10">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full h-11 mt-2"
            >
              {isLoading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6 text-zinc-600">
          Synapse Health Technologies &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
