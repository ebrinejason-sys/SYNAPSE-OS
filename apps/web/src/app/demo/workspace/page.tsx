"use client"

import { useState } from "react"
import Link from "next/link"

const roles = ["reception", "nurse", "doctor", "lab", "pharmacist", "cashier"]
export default function DemoWorkspace() {
  const [role, setRole] = useState(() => typeof window === "undefined" ? "reception" : sessionStorage.getItem("synapse_demo_role") ?? "reception")
  async function switchRole(next: string) {
    const response = await fetch("/api/demo/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: next }) })
    if (response.ok) { setRole(next); sessionStorage.setItem("synapse_demo_role", next) }
  }
  return <main className="min-h-screen bg-background text-foreground p-6"><div className="mx-auto max-w-4xl space-y-6"><p className="text-sm text-muted-foreground">SYNTHETIC DEMO · Amina Demo</p><h1 className="text-3xl font-bold">Hospital Test Drive</h1><p>Current role: <strong className="capitalize">{role}</strong></p><div className="flex flex-wrap gap-2">{roles.map(item => <button key={item} onClick={() => switchRole(item)} className="rounded-md border px-3 py-2 text-sm capitalize">Switch to {item}</button>)}</div><ol className="grid gap-3 sm:grid-cols-2">{["Reception", "Triage", "Doctor", "Lab", "Doctor review", "Pharmacy", "Billing", "Timeline"].map((step, index) => <li key={step} className="rounded-lg border bg-card p-4"><span className="font-semibold">{index + 1}. {step}</span><p className="text-sm text-muted-foreground">Synthetic workflow step</p></li>)}</ol><Link href="/demo/guide" className="underline">Open tester guide</Link></div></main>
}
