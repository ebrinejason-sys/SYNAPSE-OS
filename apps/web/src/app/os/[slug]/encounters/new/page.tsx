"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

type Differential = {
  condition: string;
  icd11_code: string | null;
  confidence: "high" | "medium" | "low";
  rationale: string;
};

type DiagnosisResult = {
  differentials: Differential[];
  suggested_workup: string[];
  red_flags: string[];
  clinical_note: string;
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  low: "bg-slate-500/15 text-slate-400 border border-slate-500/30",
};

export default function NewEncounterPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm">Loading…</div>}>
      <NewEncounterInner />
    </Suspense>
  )
}

function NewEncounterInner() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = searchParams.get("patientId") ?? "";

  const [complaint, setComplaint] = useState("");
  const [temperature, setTemperature] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [spo2, setSpo2] = useState("");
  const [aiResult, setAiResult] = useState<DiagnosisResult | null>(null);
  const [selectedDx, setSelectedDx] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function runAI() {
    if (!complaint.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chiefComplaint: complaint,
          vitals: {
            temperature_c: temperature ? Number(temperature) : undefined,
            heart_rate: heartRate ? Number(heartRate) : undefined,
            bp_systolic: bpSystolic ? Number(bpSystolic) : undefined,
            bp_diastolic: bpDiastolic ? Number(bpDiastolic) : undefined,
            spo2: spo2 ? Number(spo2) : undefined,
          },
        }),
      });
      setAiResult((await res.json()) as DiagnosisResult);
    } finally {
      setAiLoading(false);
    }
  }

  async function saveEncounter() {
    if (!patientId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/opd/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          chief_complaint: complaint,
          clinical_stage: selectedDx ?? undefined,
          temperature_c: temperature ? Number(temperature) : undefined,
          heart_rate: heartRate ? Number(heartRate) : undefined,
          bp_systolic: bpSystolic ? Number(bpSystolic) : undefined,
          bp_diastolic: bpDiastolic ? Number(bpDiastolic) : undefined,
          spo2: spo2 ? Number(spo2) : undefined,
        }),
      });
      if (res.ok) {
        router.push(`/os/${params.slug}/patients/${patientId}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold mb-6">New Encounter</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col 1: Vitals + Complaint */}
        <div className="space-y-5">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Chief Complaint *</label>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={4}
              className="w-full bg-[#0D1B2E] border border-slate-700 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:border-[#00D4AA]"
              placeholder="Patient's presenting complaint..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Temp (°C)", val: temperature, set: setTemperature },
              { label: "HR (bpm)", val: heartRate, set: setHeartRate },
              { label: "BP Sys", val: bpSystolic, set: setBpSystolic },
              { label: "BP Dia", val: bpDiastolic, set: setBpDiastolic },
              { label: "SpO2 (%)", val: spo2, set: setSpo2 },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="w-full bg-[#0D1B2E] border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#00D4AA]"
                />
              </div>
            ))}
          </div>
          <button
            onClick={runAI}
            disabled={aiLoading || !complaint.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 text-sm"
          >
            {aiLoading ? "Analysing..." : "Run AI Differential"}
          </button>
        </div>

        {/* Col 2: AI Results */}
        <div className="bg-[#0D1B2E] border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">AI Differential</h2>
          {!aiResult && !aiLoading && (
            <p className="text-slate-500 text-sm">Run AI to see differentials</p>
          )}
          {aiLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-4 h-4 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin" />
              Analysing...
            </div>
          )}
          {aiResult && (
            <div className="space-y-2">
              {aiResult.differentials.map((d, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDx(d.condition)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedDx === d.condition
                      ? "border-[#00D4AA] bg-[#00D4AA]/10"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{d.condition}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${CONFIDENCE_STYLES[d.confidence]}`}
                    >
                      {d.confidence}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{d.rationale}</p>
                </button>
              ))}
              {aiResult.red_flags.length > 0 && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-400 font-medium mb-1">Red Flags</p>
                  {aiResult.red_flags.map((f, i) => (
                    <p key={i} className="text-xs text-red-300">
                      • {f}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Col 3: Summary + Save */}
        <div className="bg-[#0D1B2E] border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Complaint</span>
              <span className="text-white text-right max-w-[60%] truncate">{complaint || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Diagnosis</span>
              <span className="text-[#00D4AA] text-right max-w-[60%] truncate">
                {selectedDx ?? "Not selected"}
              </span>
            </div>
          </div>
          {aiResult && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Suggested workup</p>
              <ul className="text-xs text-slate-300 space-y-0.5">
                {aiResult.suggested_workup.slice(0, 4).map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}
          {!patientId && (
            <p className="text-xs text-amber-400">Select a patient before saving the encounter.</p>
          )}
          <button
            onClick={saveEncounter}
            disabled={saving || !complaint.trim() || !patientId}
            className="w-full bg-[#00D4AA] text-[#060D1A] font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {saving ? "Saving..." : "Complete Encounter"}
          </button>
        </div>
      </div>
    </div>
  );
}
