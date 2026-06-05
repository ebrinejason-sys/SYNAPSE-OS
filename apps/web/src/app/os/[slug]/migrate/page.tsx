"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";

type Step = 1 | 2 | 3 | 4;
type SourceType = "csv" | "openmrs_fhir" | "manual_entry";

const STEPS = ["Select Source", "Upload File", "Validate", "Import"];

export default function MigratePage() {
  const params = useParams<{ slug: string }>();
  const [step, setStep] = useState<Step>(1);
  const [sourceType, setSourceType] = useState<SourceType>("csv");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<string>("idle");
  const [summary, setSummary] = useState<{ validRows?: number; errorRows?: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleStart() {
    const res = await fetch("/api/import/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId: params.slug,
        sourceType,
        sourceName: file?.name ?? "manual",
        importScope: "patients",
      }),
    });
    const data = await res.json() as { batchId?: string };
    if (data.batchId) {
      setBatchId(data.batchId);
      setStep(2);
    }
  }

  async function handleUpload() {
    if (!file || !batchId) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("batchId", batchId);
    const res = await fetch("/api/import/upload", { method: "POST", body: form });
    const data = await res.json() as { totalRows?: number; validRows?: number; errorRows?: number };
    setSummary(data);
    setUploading(false);
    setStep(3);
  }

  function pollProgress(id: string) {
    const poll = setInterval(async () => {
      const res = await fetch(`/api/import/status/${id}`);
      const data = await res.json() as {
        progressPercent?: number;
        status?: string;
        validRows?: number;
        errorRows?: number;
      };
      setProgress(data.progressPercent ?? 0);
      if (data.status === "completed" || data.status === "failed") {
        clearInterval(poll);
        setImportStatus(data.status ?? "failed");
        setSummary({ validRows: data.validRows, errorRows: data.errorRows });
      }
    }, 2000);
  }

  async function handleExecute() {
    if (!batchId) return;
    setStep(4);
    setExecuting(true);
    setImportStatus("running");
    await fetch("/api/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId }),
    });
    setExecuting(false);
    pollProgress(batchId);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-2">Data Migration</h1>
      <p className="text-slate-400 text-sm mb-8">
        Import patient records from CSV, OpenMRS, or manual entry
      </p>

      {/* Step indicator */}
      <div className="flex items-center mb-8 gap-1">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step;
          return (
            <div key={n} className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= n ? "bg-[#00D4AA] text-[#060D1A]" : "bg-slate-800 text-slate-400"
                }`}
              >
                {n}
              </div>
              <span className={`text-xs whitespace-nowrap ${step >= n ? "text-white" : "text-slate-500"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-6 mx-1 ${step > n ? "bg-[#00D4AA]" : "bg-slate-700"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {(["csv", "openmrs_fhir", "manual_entry"] as SourceType[]).map((s) => (
              <button
                key={s}
                onClick={() => setSourceType(s)}
                className={`p-4 rounded-xl border text-sm font-medium text-left transition-colors ${
                  sourceType === s
                    ? "border-[#00D4AA] bg-[#00D4AA]/10 text-[#00D4AA]"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                {s === "csv" ? "CSV / Excel" : s === "openmrs_fhir" ? "OpenMRS / FHIR" : "Manual Entry"}
              </button>
            ))}
          </div>
          {sourceType === "csv" && (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-[#00D4AA] rounded-xl p-10 text-center cursor-pointer transition-colors"
            >
              <p className="text-slate-300 font-medium">
                {file ? file.name : "Drop CSV or Excel file here"}
              </p>
              <p className="text-slate-500 text-sm mt-1">Max 50MB · CSV or XLSX</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
          <button
            onClick={handleStart}
            disabled={sourceType === "csv" && !file}
            className="w-full bg-[#00D4AA] text-[#060D1A] font-bold py-3 rounded-xl disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-[#0D1B2E] border border-slate-800 rounded-xl p-5">
            <p className="text-slate-400 text-sm mb-1">Batch ID</p>
            <p className="font-mono text-xs text-[#00D4AA]">{batchId}</p>
          </div>
          {file && (
            <p className="text-slate-300 text-sm">
              Ready to upload: <span className="text-white font-medium">{file.name}</span>
            </p>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-[#00D4AA] text-[#060D1A] font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {uploading ? "Uploading & parsing..." : "Upload & Parse"}
          </button>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && summary !== null && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-emerald-400">{summary.validRows ?? 0}</p>
              <p className="text-sm text-emerald-400 mt-1">Valid rows</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-red-400">{summary.errorRows ?? 0}</p>
              <p className="text-sm text-red-400 mt-1">Error rows</p>
            </div>
          </div>
          <button
            onClick={handleExecute}
            className="w-full bg-[#00D4AA] text-[#060D1A] font-bold py-3 rounded-xl"
          >
            Execute Import
          </button>
        </div>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <div className="text-center">
          <div className="bg-[#0D1B2E] border border-slate-800 rounded-xl p-10">
            {(importStatus === "running" || executing) && (
              <>
                <div className="w-10 h-10 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-300 font-medium mb-3">Importing...</p>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-[#00D4AA] h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-slate-400 text-sm mt-2">{progress}%</p>
              </>
            )}
            {importStatus === "completed" && (
              <>
                <p className="text-5xl mb-4">Done</p>
                <p className="text-xl font-bold text-[#00D4AA]">Import Complete</p>
                <p className="text-slate-400 text-sm mt-2">
                  {summary?.validRows ?? 0} patients imported
                </p>
                <a
                  href={`/os/${params.slug}/patients`}
                  className="inline-block mt-5 bg-[#00D4AA] text-[#060D1A] font-bold px-6 py-2.5 rounded-xl"
                >
                  View imported patients
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
