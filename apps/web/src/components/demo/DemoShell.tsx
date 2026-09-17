"use client"
import Link from "next/link"
export function DemoShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-background text-foreground p-6"><div className="mx-auto max-w-5xl space-y-6"><header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"><div><span className="text-xs font-bold text-primary">SYNTHETIC PLAYGROUND</span><h1 className="text-3xl font-bold">{title}</h1></div><nav className="flex gap-3 text-sm"><Link href="/demo">Home</Link><Link href="/demo/workspace">Workspace</Link><Link href="/demo/guide">Guide</Link></nav></header><div className="rounded-lg border bg-card p-4 text-sm">Demo Hospital · Amina Demo · No real patient data</div>{children}</div></main>
}
