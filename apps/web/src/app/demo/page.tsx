"use client";

import { useState } from "react";
import { SynapseLogo } from "../../components/SynapseLogo";

type Differential = {
  condition: string;
  icd11_code: string | null;
  confidence: "high" | "medium" | "low";
  rationale: string;
  key_features: string;
};

type DiagnosisResult = {
  differentials: Differential[];
  suggested_workup: string[];
  red_flags: string[];
  clinical_note: string;
  ucg_reference: string | null;
  ai_model?: string;
  ai_provider?: string;
};

const EXAMPLE_CASES = [
  {
    complaint: "3-day fever, headache, and body aches in a child",
    age: 8,
    sex: "male",
    vitals: { temperature_c: 38.9, heart_rate: 104, bp_systolic: 100, bp_diastolic: 65, spo2: 98 },
  },
  {
    complaint: "Persistent cough for 6 weeks with night sweats and weight loss",
    age: 34,
    sex: "female",
    vitals: { temperature_c: 37.8, heart_rate: 88, bp_systolic: 110, bp_diastolic: 72, spo2: 95 },
  },
  {
    complaint: "Severe abdominal pain, vomiting, and watery diarrhoea for 2 days",
    age: 22,
    sex: "male",
    vitals: { temperature_c: 38.2, heart_rate: 112, bp_systolic: 95, bp_diastolic: 60, spo2: 99 },
  },
];

const CONFIDENCE_COLOR: { [K in "high" | "medium" | "low"]: { bg: string; text: string; border: string } } = {
  high:   { bg: "rgba(34,197,94,0.10)",  text: "#22C55E", border: "rgba(34,197,94,0.25)"  },
  medium: { bg: "rgba(234,179,8,0.10)",  text: "#EAB308", border: "rgba(234,179,8,0.25)"  },
  low:    { bg: "rgba(160,160,176,0.10)", text: "#A0A0B0", border: "rgba(160,160,176,0.25)" },
};

const DEFAULT_AI_BADGE = { label: "AI Model", color: "#F97316" };
const AI_BADGE: Record<string, { label: string; color: string }> = {
  gemini:     { label: "Gemini 2.0 Flash",         color: "#4285F4" },
  deepseek:   { label: "DeepSeek via OpenRouter",   color: "#7C3AED" },
  openrouter: { label: "OpenRouter",                color: "#F97316" },
};

const VITALS_KEYS = ["temperature_c", "heart_rate", "bp_systolic", "bp_diastolic", "spo2"] as const;
const VITALS_LABELS: Record<string, string> = {
  temperature_c: "Temp (°C)",
  heart_rate: "Heart Rate",
  bp_systolic: "BP Systolic",
  bp_diastolic: "BP Diastolic",
  spo2: "SpO₂ (%)",
};
type VitalKey = typeof VITALS_KEYS[number];

export default function DemoPage() {
  const [complaint, setComplaint] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("unknown");
  const [showVitals, setShowVitals] = useState(false);
  const [vitals, setVitals] = useState<Record<VitalKey, string>>({
    temperature_c: "",
    heart_rate: "",
    bp_systolic: "",
    bp_diastolic: "",
    spo2: "",
  });
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadExample() {
    const ex = EXAMPLE_CASES[Math.floor(Math.random() * EXAMPLE_CASES.length)];
    if (!ex) return;
    setComplaint(ex.complaint);
    setAge(String(ex.age));
    setSex(ex.sex);
    setShowVitals(true);
    setVitals({
      temperature_c: String(ex.vitals.temperature_c),
      heart_rate: String(ex.vitals.heart_rate),
      bp_systolic: String(ex.vitals.bp_systolic),
      bp_diastolic: String(ex.vitals.bp_diastolic),
      spo2: String(ex.vitals.spo2),
    });
  }

  async function generate() {
    if (!complaint.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/demo/differential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chiefComplaint: complaint,
          age: age ? Number(age) : undefined,
          sex,
          vitals: showVitals
            ? Object.fromEntries(
                VITALS_KEYS.filter((k) => vitals[k]).map((k) => [k, Number(vitals[k])])
              )
            : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? `Server error ${res.status}`);
      }
      setResult(await res.json() as DiagnosisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const inp = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-edge)",
    color: "var(--text-primary)",
    borderRadius: "12px",
    padding: "10px 14px",
    fontSize: "14px",
    width: "100%",
    outline: "none",
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Nav */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--nav-glass)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}
      >
        <div className="flex items-center gap-3">
          <SynapseLogo size="sm" />
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-md"
            style={{ background: "rgba(249,115,22,0.15)", color: "var(--brand-orange)", border: "1px solid var(--border-orange)" }}
          >
            AI Demo
          </span>
        </div>
        <a
          href="https://synapseos.tech/apply"
          style={{
            background: "var(--brand-orange)",
            color: "#07070A",
            fontWeight: 700,
            fontSize: "13px",
            padding: "8px 16px",
            borderRadius: "10px",
            textDecoration: "none",
          }}
        >
          Register your hospital →
        </a>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT — Input */}
        <div className="space-y-5">
          <div>
            <h1 className="font-display font-bold text-2xl mb-1" style={{ letterSpacing: "-0.02em" }}>
              Clinical AI Demo
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Grounded in Uganda Clinical Guidelines · Multi-model AI
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>
              Chief Complaint *
            </label>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Describe the patient's main complaint..."
              rows={4}
              style={{ ...inp, resize: "none" }}
              onFocus={e => (e.target.style.borderColor = "var(--brand-orange)")}
              onBlur={e => (e.target.style.borderColor = "var(--border-edge)")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Years"
                style={inp}
                onFocus={e => (e.target.style.borderColor = "var(--brand-orange)")}
                onBlur={e => (e.target.style.borderColor = "var(--border-edge)")}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                style={inp}
              >
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => setShowVitals(!showVitals)}
            className="text-xs font-semibold"
            style={{ color: "var(--brand-orange)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {showVitals ? "▼ Hide vitals" : "▶ Add vitals (optional)"}
          </button>

          {showVitals && (
            <div
              className="grid grid-cols-2 gap-3 p-4 rounded-xl"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-edge)" }}
            >
              {VITALS_KEYS.map((key) => (
                <div key={key}>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                    {VITALS_LABELS[key]}
                  </label>
                  <input
                    type="number"
                    value={vitals[key]}
                    onChange={(e) => setVitals((v) => ({ ...v, [key]: e.target.value }))}
                    style={{ ...inp, background: "var(--bg-elevated)" }}
                    onFocus={e => (e.target.style.borderColor = "var(--brand-orange)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border-edge)")}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={generate}
              disabled={loading || !complaint.trim()}
              className="flex-1 font-bold py-3 rounded-xl transition-all"
              style={{
                background: loading || !complaint.trim() ? "rgba(249,115,22,0.4)" : "var(--brand-orange)",
                color: "#07070A",
                cursor: loading || !complaint.trim() ? "not-allowed" : "pointer",
                border: "none",
                fontSize: "15px",
              }}
            >
              {loading ? "Analysing…" : "Generate Differential →"}
            </button>
            <button
              onClick={loadExample}
              className="px-4 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "transparent", border: "1px solid var(--border-edge)", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              Load Example
            </button>
          </div>

          {error && (
            <div
              className="px-4 py-3 rounded-xl text-sm"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444" }}
            >
              {error}
            </div>
          )}

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            For educational purposes only. Not for clinical use without physician oversight.
          </p>
        </div>

        {/* RIGHT — Results */}
        <div>
          {!result && !loading && (
            <div className="h-full flex items-center justify-center text-center" style={{ minHeight: "320px" }}>
              <div className="space-y-4">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="1.5" className="mx-auto opacity-50">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Enter a chief complaint and click Generate<br/>to see AI-assisted differentials.
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="h-full flex items-center justify-center" style={{ minHeight: "320px" }}>
              <div className="space-y-4 text-center">
                <div
                  className="w-10 h-10 rounded-full animate-spin mx-auto"
                  style={{ border: "2px solid var(--border-edge)", borderTopColor: "var(--brand-orange)" }}
                />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Consulting clinical AI…
                </p>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* AI source badge */}
              {result.ai_provider && (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Powered by</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-md"
                    style={{
                      background: `${(AI_BADGE[result.ai_provider] ?? DEFAULT_AI_BADGE).color}18`,
                      color: (AI_BADGE[result.ai_provider] ?? DEFAULT_AI_BADGE).color,
                      border: `1px solid ${(AI_BADGE[result.ai_provider] ?? DEFAULT_AI_BADGE).color}40`,
                    }}
                  >
                    {(AI_BADGE[result.ai_provider] ?? DEFAULT_AI_BADGE).label}
                  </span>
                </div>
              )}

              {/* Clinical note */}
              {result.clinical_note && (
                <div
                  className="px-4 py-3 rounded-xl"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-orange)" }}
                >
                  <p className="text-xs font-bold mb-1" style={{ color: "var(--brand-orange)" }}>Clinical Summary</p>
                  <p className="text-sm" style={{ color: "var(--text-primary)" }}>{result.clinical_note}</p>
                </div>
              )}

              {/* Differentials */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Differential Diagnoses
                </h3>
                <div className="space-y-3">
                  {result.differentials.map((d, i) => {
                    const conf = CONFIDENCE_COLOR[d.confidence] ?? CONFIDENCE_COLOR.low;
                    return (
                      <div
                        key={i}
                        className="p-4 rounded-xl"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-edge)" }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{d.condition}</span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                            style={{ background: conf.bg, color: conf.text, border: `1px solid ${conf.border}` }}
                          >
                            {d.confidence}
                          </span>
                        </div>
                        {d.icd11_code && (
                          <p className="text-xs font-mono mb-1.5" style={{ color: "var(--brand-gold)" }}>{d.icd11_code}</p>
                        )}
                        <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{d.rationale}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{d.key_features}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Workup */}
              {result.suggested_workup.length > 0 && (
                <div
                  className="p-4 rounded-xl"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-edge)" }}
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Suggested Workup
                  </h3>
                  <ul className="space-y-1">
                    {result.suggested_workup.map((w, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                        <span style={{ color: "var(--brand-orange)" }}>•</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Red flags */}
              {result.red_flags.length > 0 && (
                <div
                  className="p-4 rounded-xl"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#EF4444" }}>
                    ⚠ Red Flags
                  </h3>
                  <ul className="space-y-1">
                    {result.red_flags.map((f, i) => (
                      <li key={i} className="text-sm" style={{ color: "#FCA5A5" }}>• {f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.ucg_reference && (
                <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                  UCG Reference: {result.ucg_reference}
                </p>
              )}

              {/* CTA */}
              <div
                className="p-5 rounded-xl text-center"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-orange)" }}
              >
                <p className="font-bold mb-1" style={{ color: "var(--brand-orange)" }}>
                  Ready to deploy in your hospital?
                </p>
                <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                  Full EHR + AI diagnosis + billing + pharmacy in one platform.
                </p>
                <a
                  href="https://synapseos.tech/apply"
                  style={{
                    display: "inline-block",
                    background: "var(--brand-orange)",
                    color: "#07070A",
                    fontWeight: 700,
                    padding: "10px 20px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    fontSize: "14px",
                  }}
                >
                  Apply for Pilot Access →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
