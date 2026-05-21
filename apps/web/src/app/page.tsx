import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen" style={{ background: "#060D1A", color: "#f0f4ff", fontFamily: "var(--font-body)" }}>
      <nav style={{ borderBottom: "1px solid rgba(0,212,170,0.15)", padding: "1rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", color: "#00D4AA" }}>Synapse OS</span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <Link href="/features" style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Features</Link>
          <Link href="/pricing" style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Pricing</Link>
          <Link href="/demo" style={{ color: "#94a3b8", fontSize: "0.875rem" }}>Demo</Link>
          <Link href="/apply" style={{ background: "#00D4AA", color: "#060D1A", padding: "0.5rem 1rem", borderRadius: "0.375rem", fontSize: "0.875rem", fontWeight: 600 }}>Apply for Access</Link>
        </div>
      </nav>
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "6rem 2rem", textAlign: "center" }}>
        <div style={{ background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.3)", borderRadius: "2rem", padding: "0.375rem 1rem", display: "inline-block", marginBottom: "2rem", fontSize: "0.75rem", color: "#00D4AA" }}>
          Built in Uganda · Powered by MedGemma AI
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "1.5rem" }}>
          Every Hospital.<br />
          <span style={{ color: "#00D4AA" }}>Every Patient.</span><br />
          Every Step — AI-Assisted.
        </h1>
        <p style={{ fontSize: "1.125rem", color: "#94a3b8", maxWidth: "42rem", margin: "0 auto 3rem" }}>
          Synapse OS is an AI-powered Health Management Information System built for Africa.
          Every department. Every workflow. Offline-first. FHIR R4 compliant. Grounded in Uganda Clinical Guidelines.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/demo" style={{ background: "#00D4AA", color: "#060D1A", padding: "0.875rem 2rem", borderRadius: "0.5rem", fontWeight: 700, fontSize: "1rem" }}>Launch Interactive Demo</Link>
          <Link href="/apply" style={{ border: "1px solid rgba(0,212,170,0.4)", color: "#00D4AA", padding: "0.875rem 2rem", borderRadius: "0.5rem", fontWeight: 600, fontSize: "1rem" }}>Apply for Pilot Access</Link>
        </div>
      </div>
    </main>
  );
}
