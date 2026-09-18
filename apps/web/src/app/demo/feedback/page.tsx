"use client";

import { useState } from "react";
import { DEMO_ROUTES, demoHref } from "../../../lib/demo/paths";
import { DemoMast } from "../../../components/demo/DemoMast";

const CATEGORIES = [
  { id: "bug", label: "Bug / Broken Flow", icon: "🐛" },
  { id: "ux", label: "UX / Usability", icon: "🎯" },
  { id: "missing", label: "Missing Feature", icon: "📝" },
  { id: "question", label: "Question", icon: "❓" },
  { id: "other", label: "Other", icon: "💬" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

export default function DemoFeedbackPage() {
  const [category, setCategory] = useState<CategoryId>(CATEGORIES[0].id);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please describe your feedback.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, email: email.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setSubmitted(true);
      setMessage("");
      setEmail("");
    } catch (e) {
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen">
      <DemoMast badge="FEEDBACK">
        <a
          href={DEMO_ROUTES.guide}
          className="font-mono text-xs uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
          onClick={(event) => {
            event.preventDefault()
            window.location.assign(demoHref("guide"))
          }}
        >
          Back to guide
        </a>
      </DemoMast>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl sm:text-4xl mb-4" style={{ letterSpacing: "-0.02em" }}>
            Report a Problem / Share Feedback
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Your input helps make SYNAPSE better. No personal data required.
          </p>
        </div>

        {submitted && (
          <div
            className="p-6 rounded-2xl text-center mb-8"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            <div className="text-4xl mb-2">✅</div>
            <h2 className="font-bold text-xl mb-2" style={{ color: "#22C55E" }}>Thank You!</h2>
            <p style={{ color: "var(--text-secondary)" }}>
              Your feedback has been received. The team will review it shortly.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-4 px-4 py-2 rounded-xl font-semibold"
              style={{ background: "var(--brand-orange)", color: "#07070A", border: "none", cursor: "pointer" }}
            >
              Send Another
            </button>
          </div>
        )}

        {!submitted && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className="p-4 rounded-xl text-left transition-all border-2"
                    style={{
                      background: category === cat.id ? `${cat.icon === "🐛" ? "#EF4444" : cat.icon === "🎯" ? "#10B981" : cat.icon === "📝" ? "#F59E0B" : cat.icon === "❓" ? "#3B82F6" : "#8B5CF6"}15` : "var(--bg-surface)",
                      borderColor: category === cat.id ? (cat.icon === "🐛" ? "#EF4444" : cat.icon === "🎯" ? "#10B981" : cat.icon === "📝" ? "#F59E0B" : cat.icon === "❓" ? "#3B82F6" : "#8B5CF6") : "var(--border-edge)",
                      cursor: "pointer",
                    }}
                  >
                    <div className="text-2xl mb-1">{cat.icon}</div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{cat.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                What happened? What did you expect?
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="Describe the issue, the steps to reproduce, what you expected vs what happened..."
                className="w-full rounded-xl px-4 py-3 text-sm resize-none"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-edge)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                Email (optional — only if you want a reply)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-3 text-sm"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-edge)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
            </div>

            {error && (
              <div
                className="px-4 py-3 rounded-xl text-sm text-center"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-full py-3 rounded-xl font-bold text-lg transition-opacity"
              style={{
                background: submitting || !message.trim() ? "rgba(249,115,22,0.4)" : "var(--brand-orange)",
                color: "#07070A",
                border: "none",
                cursor: submitting || !message.trim() ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Sending…" : "Submit Feedback"}
            </button>

            <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
              This is a synthetic demo environment. Feedback goes to the SYNAPSE team only.
              No real patient data is ever collected here.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}