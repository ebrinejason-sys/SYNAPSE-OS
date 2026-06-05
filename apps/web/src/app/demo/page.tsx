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
};

const EXAMPLE_CASES = [
  {
    complaint: "3-day fever, headache, and body aches",
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
    complaint: "Severe abdominal pain, vomiting, and diarrhoea for 2 days",
    age: 22,
    sex: "male",
    vitals: { temperature_c: 38.2, heart_rate: 112, bp_systolic: 95, bp_diastolic: 60, spo2: 99 },
  },
];

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  low: "bg-slate-500/15 text-slate-400 border border-slate-500/30",
};

const VITALS_KEYS = ["temperature_c", "heart_rate", "bp_systolic", "bp_diastolic", "spo2"] as const;
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
        throw new Error(err.error ?? "Request failed");
      }
      setResult(await res.json() as DiagnosisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#060D1A] text-white">
      <header className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-edge)' }}>
        <div className="flex items-center gap-3">
          <SynapseLogo size="sm" />
          <span className="text-xs px-2 py-0.5 rounded font-medium badge-orange">AI Demo</span>
        </div>
        <a
          href="https://synapseos.tech/apply-professional"
          className="text-sm bg-[#00D4AA] text-[#060D1A] font-semibold px-4 py-2 rounded-lg hover:bg-[#00b894] transition-colors"
        >
          Register your hospital →
        </a>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT — Input */}
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold mb-1">Clinical AI Demo</h1>
            <p className="text-slate-400 text-sm">
              Powered by Gemini 2.0 Flash · Grounded in Uganda Clinical Guidelines
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Chief Complaint *
            </label>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Describe the patient's main complaint..."
              rows={4}
              className="w-full bg-[#0D1B2E] border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00D4AA] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Years"
                className="w-full bg-[#0D1B2E] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00D4AA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full bg-[#0D1B2E] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00D4AA]"
              >
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => setShowVitals(!showVitals)}
            className="text-xs text-[#00D4AA] hover:underline"
          >
            {showVitals ? "▼ Hide vitals" : "▶ Add vitals (optional)"}
          </button>

          {showVitals && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-[#0D1B2E] rounded-lg border border-slate-700">
              {VITALS_KEYS.map((key) => (
                <div key={key}>
                  <label className="block text-xs text-slate-400 mb-1">
                    {key.replace(/_/g, " ")}
                  </label>
                  <input
                    type="number"
                    value={vitals[key]}
                    onChange={(e) =>
                      setVitals((v) => ({ ...v, [key]: e.target.value }))
                    }
                    className="w-full bg-[#060D1A] border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00D4AA]"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={generate}
              disabled={loading || !complaint.trim()}
              className="flex-1 bg-[#00D4AA] text-[#060D1A] font-bold py-3 rounded-xl hover:bg-[#00b894] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Analysing..." : "Generate Differential →"}
            </button>
            <button
              onClick={loadExample}
              className="px-4 py-3 border border-slate-600 text-slate-300 rounded-xl hover:border-slate-400 text-sm"
            >
              Load Example
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <p className="text-xs text-slate-500">
            For educational purposes only. Not for clinical use without physician oversight.
          </p>
        </div>

        {/* RIGHT — Results */}
        <div>
          {!result && !loading && (
            <div className="h-full flex items-center justify-center text-center">
              <div className="space-y-3">
                <div className="text-5xl">🩺</div>
                <p className="text-slate-400">
                  Enter a chief complaint and click Generate to see AI-assisted differentials.
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="space-y-4 text-center">
                <div className="w-10 h-10 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-400 text-sm">Analysing with Gemini 2.0 Flash...</p>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-5">
              {result.clinical_note && (
                <div className="bg-[#0D1B2E] border border-[#00D4AA]/30 rounded-lg px-4 py-3">
                  <p className="text-xs font-medium text-[#00D4AA] mb-1">Clinical Summary</p>
                  <p className="text-sm text-slate-200">{result.clinical_note}</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Differential Diagnoses
                </h3>
                <div className="space-y-3">
                  {result.differentials.map((d, i) => (
                    <div
                      key={i}
                      className="bg-[#0D1B2E] border border-slate-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-semibold text-white">{d.condition}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${CONFIDENCE_STYLES[d.confidence]}`}
                        >
                          {d.confidence}
                        </span>
                      </div>
                      {d.icd11_code && (
                        <p className="text-xs font-mono text-teal-400 mb-1">{d.icd11_code}</p>
                      )}
                      <p className="text-sm text-slate-300 mb-1">{d.rationale}</p>
                      <p className="text-xs text-slate-500">{d.key_features}</p>
                    </div>
                  ))}
                </div>
              </div>

              {result.suggested_workup.length > 0 && (
                <div className="bg-[#0D1B2E] border border-slate-700 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Suggested Workup
                  </h3>
                  <ul className="space-y-1">
                    {result.suggested_workup.map((w, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                        <span className="text-[#00D4AA]">•</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.red_flags.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                    ⚠ Red Flags
                  </h3>
                  <ul className="space-y-1">
                    {result.red_flags.map((f, i) => (
                      <li key={i} className="text-sm text-red-300">
                        • {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.ucg_reference && (
                <p className="text-xs text-slate-500 italic">
                  UCG Reference: {result.ucg_reference}
                </p>
              )}

              <div className="bg-[#00D4AA]/10 border border-[#00D4AA]/30 rounded-xl p-5 text-center">
                <p className="font-semibold text-[#00D4AA] mb-1">Ready for your hospital?</p>
                <p className="text-sm text-slate-300 mb-3">
                  Full EHR + AI diagnosis + billing + pharmacy in one platform.
                </p>
                <a
                  href="https://synapseos.tech/apply-professional"
                  className="inline-block bg-[#00D4AA] text-[#060D1A] font-bold px-5 py-2.5 rounded-lg hover:bg-[#00b894] transition-colors text-sm"
                >
                  Register your hospital →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
