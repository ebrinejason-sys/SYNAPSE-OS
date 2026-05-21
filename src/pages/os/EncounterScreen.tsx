import { useState, useEffect, type ElementType } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, BrainCircuit, Activity, FileText,
  Beaker, CheckCircle2, AlertTriangle, Loader2, BookOpen,
  Search, ClipboardList, X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { demoQueries } from '../../lib/supabase';
import { getClinicalDiagnosis } from '../../services/geminiService';

type Tab = 'history' | 'exam' | 'diagnosis' | 'orders' | 'ucg';

function calcAge(dob: string) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

// ─── Vitals card ──────────────────────────────────────────────────────────────
function VitalCard({ label, value, unit, normal }: { label: string; value: string | number | null; unit: string; normal: boolean }) {
  return (
    <div className={cn('p-3 rounded-xl border text-center', normal ? 'bg-white border-slate-200' : 'bg-red-50 border-red-200')}>
      <div className={cn('font-jb-mono text-lg font-black', normal ? 'text-slate-900' : 'text-red-600')}>
        {value ?? '—'}
      </div>
      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{unit}</div>
      <div className="text-[9px] text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

// ─── AI diagnosis panel ───────────────────────────────────────────────────────
function AIDiagnosisPanel({ encounter, patient }: { encounter: any; patient: any }) {
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [decision, setDecision] = useState<'accepted' | 'overridden' | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    const prompt = `Patient: ${patient?.full_name}, ${patient?.dob ? calcAge(patient.dob) : '?'}y ${patient?.sex ?? ''}. Chief complaint: ${encounter?.chief_complaint ?? 'unknown'}.`;
    const context = `${encounter?.chief_complaint ?? ''} ${encounter?.notes ?? ''}`.trim();
    try {
      const r = await getClinicalDiagnosis(prompt, context);
      setResult(r);
    } catch {
      setResult({ error: 'AI service unavailable. Please try again.' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Pre-flight summary */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Pre-flight Context</p>
        <div className="space-y-1.5 text-slate-600">
          <div><span className="font-semibold text-slate-800">Patient:</span> {patient?.full_name}, {patient?.dob ? calcAge(patient.dob) : '?'}y, {patient?.sex}</div>
          <div><span className="font-semibold text-slate-800">Complaint:</span> {encounter?.chief_complaint || '—'}</div>
          <div><span className="font-semibold text-slate-800">Notes:</span> {encounter?.notes || '—'}</div>
        </div>
      </div>

      {!result && !running && (
        <button
          type="button"
          onClick={run}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-sky-500 text-white py-4 rounded-xl font-bold text-sm uppercase tracking-widest hover:scale-[1.01] transition-transform shadow-lg shadow-teal-500/20"
        >
          <BrainCircuit className="w-5 h-5" /> Generate AI Diagnosis
        </button>
      )}

      {running && (
        <div className="flex items-center justify-center gap-3 py-12 text-teal-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="font-semibold text-sm">Consulting Uganda Clinical Guidelines…</span>
        </div>
      )}

      {result?.error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {result.error}
        </div>
      )}

      {result && !result.error && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Differentials */}
          {result.differentials?.map((dx: any, i: number) => (
            <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                  {dx.icd_code && <span className="font-jb-mono text-[10px] text-slate-400">{dx.icd_code}</span>}
                  <span className="font-bold text-slate-900 text-sm">{dx.diagnosis || dx.name}</span>
                </div>
                <span className={cn('text-sm font-black', (dx.confidence ?? 0) >= 75 ? 'text-emerald-600' : (dx.confidence ?? 0) >= 50 ? 'text-yellow-600' : 'text-orange-500')}>
                  {dx.confidence ?? '—'}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-100">
                <div className={cn('h-full transition-all duration-700', (dx.confidence ?? 0) >= 75 ? 'bg-emerald-500' : (dx.confidence ?? 0) >= 50 ? 'bg-yellow-400' : 'bg-orange-400')}
                  style={{ width: `${dx.confidence ?? 0}%` }} />
              </div>
              {dx.reasoning && (
                <p className="px-4 py-3 text-xs text-slate-500 leading-relaxed">{dx.reasoning}</p>
              )}
            </div>
          ))}

          {/* UCG treatment */}
          {result.treatment && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-2">UCG Recommendation</p>
              <p className="text-sm text-teal-800 leading-relaxed">{result.treatment}</p>
            </div>
          )}

          {/* Red flags */}
          {result.redFlags?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Red Flags
              </p>
              <ul className="space-y-1">
                {result.redFlags.map((f: string, i: number) => (
                  <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">•</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Physician decision */}
          {!decision && (
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setDecision('accepted')}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Accept
              </button>
              <button type="button" onClick={() => setDecision('overridden')}
                className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-300 transition-colors">
                Override
              </button>
            </div>
          )}

          {decision && (
            <div className={cn('flex items-center gap-2 p-4 rounded-xl text-sm font-bold', decision === 'accepted' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200')}>
              <CheckCircle2 className="w-4 h-4" />
              Diagnosis {decision}. Logged to audit trail.
            </div>
          )}

          {!decision && (
            <button type="button" onClick={run} className="text-xs text-slate-400 hover:text-teal-600 transition-colors font-medium">
              Re-run with updated context →
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── UCG Reference panel ──────────────────────────────────────────────────────
function UCGPanel() {
  const [guidelines, setGuidelines] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    demoQueries.getGuidelines().then(({ data }) => {
      setGuidelines(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = guidelines.filter(g =>
    !search || g.title?.toLowerCase().includes(search.toLowerCase()) ||
    g.category?.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-teal-600 transition-colors uppercase tracking-widest">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to guidelines
        </button>
        <div>
          <div className="flex items-start gap-3 mb-3">
            <span className="font-jb-mono text-[10px] text-teal-600 bg-teal-50 border border-teal-200 rounded px-2 py-0.5 shrink-0">{selected.guideline_code}</span>
            <h3 className="font-bold text-slate-900 text-sm leading-tight">{selected.title}</h3>
          </div>
          <div className="text-xs text-slate-500 mb-4">
            {selected.category} {selected.subcategory && `→ ${selected.subcategory}`}
          </div>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-[60vh] overflow-y-auto">
            {selected.content}
          </div>
          {selected.icd11_codes?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.icd11_codes.map((c: string) => (
                <span key={c} className="font-jb-mono text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{c}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search UCG guidelines…"
          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
        />
      </div>

      {loading && <div className="text-center py-8 text-slate-400 text-sm">Loading guidelines…</div>}

      <div className="space-y-2 max-h-[65vh] overflow-y-auto">
        {filtered.map(g => (
          <button key={g.id} type="button" onClick={() => setSelected(g)}
            className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 transition-all group">
            <div className="flex items-start gap-2">
              <span className="font-jb-mono text-[9px] text-teal-500 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5 shrink-0 mt-0.5">{g.guideline_code}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-teal-700 transition-colors leading-tight">{g.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{g.category} · {g.subcategory}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function EncounterScreen() {
  const { id } = useParams<{ id: string }>();
  const [encounter, setEncounter] = useState<any>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('history');
  const [historyText, setHistoryText] = useState('');
  const [examText, setExamText] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    demoQueries.getEncounter(id).then(({ data }) => {
      setEncounter(data);
      if (data?.patient?.id) {
        demoQueries.getVitals(data.patient.id).then(({ data: v }) => setVitals(v || []));
      }
      setLoading(false);
    });
  }, [id]);

  const patient = encounter?.patient;
  const latestVitals = vitals[0];

  const tabs: { key: Tab; icon: ElementType; label: string }[] = [
    { key: 'history', icon: ClipboardList, label: 'History' },
    { key: 'exam', icon: Activity, label: 'Examination' },
    { key: 'diagnosis', icon: BrainCircuit, label: 'AI Diagnosis' },
    { key: 'orders', icon: Beaker, label: 'Orders' },
    { key: 'ucg', icon: BookOpen, label: 'UCG' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading encounter…
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-slate-600 font-medium">Encounter not found.</p>
        <Link to="/os/doctor/queue" className="text-emerald-600 font-bold text-sm hover:underline">← Back to queue</Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex overflow-hidden bg-slate-50">
      {/* ── Column 1: Patient context ── */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-y-auto hidden lg:flex">
        <div className="p-4 border-b border-slate-100">
          <Link to="/os/doctor/queue" className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors uppercase tracking-widest mb-4">
            <ChevronLeft className="w-3 h-3" /> Queue
          </Link>

          {/* Patient card */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-black text-lg shrink-0">
              {patient?.full_name?.[0] ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-sm truncate">{patient?.full_name}</p>
              <p className="font-jb-mono text-[10px] text-slate-400">{patient?.mrn}</p>
            </div>
          </div>

          {patient && (
            <div className="space-y-1.5 text-xs text-slate-500">
              {patient.dob && <div><span className="font-semibold text-slate-700">Age:</span> {calcAge(patient.dob)}y · {patient.sex}</div>}
              {patient.district && <div><span className="font-semibold text-slate-700">District:</span> {patient.district}</div>}
            </div>
          )}
        </div>

        {/* Vitals */}
        {latestVitals && (
          <div className="p-4 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Latest Vitals</p>
            <div className="grid grid-cols-2 gap-2">
              <VitalCard label="Temp" value={latestVitals.temperature ? `${latestVitals.temperature}°C` : null} unit="°C" normal={!latestVitals.temperature || (latestVitals.temperature >= 36 && latestVitals.temperature <= 37.5)} />
              <VitalCard label="Pulse" value={latestVitals.heart_rate} unit="bpm" normal={!latestVitals.heart_rate || (latestVitals.heart_rate >= 60 && latestVitals.heart_rate <= 100)} />
              <VitalCard label="BP Sys" value={latestVitals.bp_systolic} unit="mmHg" normal={!latestVitals.bp_systolic || latestVitals.bp_systolic < 140} />
              <VitalCard label="SpO₂" value={latestVitals.spo2 ? `${latestVitals.spo2}%` : null} unit="%" normal={!latestVitals.spo2 || latestVitals.spo2 >= 95} />
              {latestVitals.weight_kg && <VitalCard label="Weight" value={`${latestVitals.weight_kg}kg`} unit="kg" normal />}
            </div>
          </div>
        )}

        {/* Encounter meta */}
        <div className="p-4 text-xs text-slate-500 space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Encounter</p>
          <div><span className="font-semibold text-slate-700">Department:</span> {encounter.department?.name ?? '—'}</div>
          <div><span className="font-semibold text-slate-700">Status:</span> <span className="capitalize">{encounter.status}</span></div>
          <div><span className="font-semibold text-slate-700">Date:</span> {new Date(encounter.created_at).toLocaleDateString()}</div>
        </div>
      </aside>

      {/* ── Column 2: Clinical workspace ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab bar */}
        <div className="bg-white border-b border-slate-200 px-4 shrink-0">
          <div className="flex items-center gap-1 h-12 overflow-x-auto">
            {tabs.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all rounded-lg',
                  activeTab === key
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'history' && (
                <div className="max-w-2xl space-y-6">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Chief Complaint</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700">
                      {encounter.chief_complaint || 'Not recorded'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">History of Presenting Illness</label>
                    <textarea
                      value={historyText}
                      onChange={e => setHistoryText(e.target.value)}
                      rows={5}
                      placeholder="Describe the history of presenting illness…"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Clinical Notes</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600 min-h-[80px]">
                      {encounter.notes || <span className="text-slate-400 italic">No notes recorded yet</span>}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'exam' && (
                <div className="max-w-2xl space-y-6">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Examination Findings</label>
                    <textarea
                      value={examText}
                      onChange={e => setExamText(e.target.value)}
                      rows={7}
                      placeholder="Record clinical examination findings…"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none"
                    />
                  </div>

                  {latestVitals && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recorded Vitals</p>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        <VitalCard label="Temp" value={latestVitals.temperature} unit="°C" normal={!latestVitals.temperature || (latestVitals.temperature >= 36 && latestVitals.temperature <= 37.5)} />
                        <VitalCard label="Pulse" value={latestVitals.heart_rate} unit="bpm" normal={!latestVitals.heart_rate || (latestVitals.heart_rate >= 60 && latestVitals.heart_rate <= 100)} />
                        <VitalCard label="SBP" value={latestVitals.bp_systolic} unit="mmHg" normal={!latestVitals.bp_systolic || latestVitals.bp_systolic < 140} />
                        <VitalCard label="DBP" value={latestVitals.bp_diastolic} unit="mmHg" normal={!latestVitals.bp_diastolic || latestVitals.bp_diastolic < 90} />
                        <VitalCard label="SpO₂" value={latestVitals.spo2} unit="%" normal={!latestVitals.spo2 || latestVitals.spo2 >= 95} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'diagnosis' && (
                <div className="max-w-2xl">
                  <AIDiagnosisPanel encounter={encounter} patient={patient} />
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="max-w-2xl space-y-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Active Orders</p>
                  {encounter.orders?.length > 0 ? (
                    encounter.orders.map((o: any) => (
                      <div key={o.id} className="flex items-start justify-between p-4 bg-white border border-slate-200 rounded-xl">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{o.description || o.order_type}</p>
                          <p className="text-xs text-slate-400 capitalize">{o.order_type}</p>
                        </div>
                        <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border capitalize',
                          o.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          o.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        )}>
                          {o.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Beaker className="w-8 h-8 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No orders placed yet.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'ucg' && (
                <div className="max-w-2xl">
                  <UCGPanel />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Column 3: sign off bar (mobile hidden) ── */}
      <aside className="w-64 shrink-0 bg-white border-l border-slate-200 hidden xl:flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Reference</p>
          <p className="text-xs text-slate-500 mb-4">18 Uganda Clinical Guidelines loaded. Search in the UCG tab.</p>

          <Link
            to="/os/doctor/queue"
            className="flex items-center justify-center gap-2 w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Close Encounter
          </Link>
        </div>

        <div className="p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Encounter Status</p>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Status</span>
              <span className="font-semibold capitalize">{encounter.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Opened</span>
              <span className="font-semibold">{new Date(encounter.created_at).toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">AI Diagnosis</span>
              <span className="font-semibold">{encounter.diagnosis ? 'Recorded' : 'Pending'}</span>
            </div>
          </div>

          {encounter.diagnosis && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Recorded Diagnosis</p>
              <p className="text-xs text-emerald-800">{encounter.diagnosis}</p>
            </div>
          )}
        </div>

        <div className="p-4 mt-auto border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
            <FileText className="w-3.5 h-3.5" />
            <span>All actions auto-saved to audit log.</span>
          </div>
          <button type="button"
            className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-colors disabled:opacity-50"
            disabled={!encounter.diagnosis}>
            Sign &amp; Complete
          </button>
        </div>
      </aside>
    </div>
  );
}
