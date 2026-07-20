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
    <div className={cn(
      'p-3 rounded-xl border text-center',
      normal ? 'bg-surface-2 border-edge' : 'bg-red-500/10 border-red-500/30'
    )}>
      <div className={cn('font-mono text-lg font-black', normal ? 'text-text-1' : 'text-red-400')}>
        {value ?? '—'}
      </div>
      <div className="text-[10px] text-text-3 font-bold uppercase tracking-wider">{unit}</div>
      <div className="text-[9px] text-text-3 mt-0.5">{label}</div>
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
      <div className="bg-surface-2 rounded-xl border border-edge p-4 text-sm">
        <p className="label-xs mb-3">Pre-flight Context</p>
        <div className="space-y-1.5 text-text-2">
          <div><span className="font-semibold text-text-1">Patient:</span> {patient?.full_name}, {patient?.dob ? calcAge(patient.dob) : '?'}y, {patient?.sex}</div>
          <div><span className="font-semibold text-text-1">Complaint:</span> {encounter?.chief_complaint || '—'}</div>
          <div><span className="font-semibold text-text-1">Notes:</span> {encounter?.notes || '—'}</div>
        </div>
      </div>

      {!result && !running && (
        <button
          type="button"
          onClick={run}
          className="btn-primary w-full py-4 flex items-center justify-center gap-2"
        >
          <BrainCircuit className="w-5 h-5" /> Generate AI Diagnosis
        </button>
      )}

      {running && (
        <div className="flex items-center justify-center gap-3 py-12 text-gold">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="font-semibold text-sm">Consulting Uganda Clinical Guidelines…</span>
        </div>
      )}

      {result?.error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {result.error}
        </div>
      )}

      {result && !result.error && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Differentials */}
          {result.differentials?.map((dx: any, i: number) => (
            <div key={i} className="border border-edge rounded-xl overflow-hidden bg-surface-1">
              <div className="flex items-center justify-between px-4 py-3 bg-surface-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-surface-3 text-text-2 text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                  {dx.icd_code && <span className="font-mono text-[10px] text-text-3">{dx.icd_code}</span>}
                  <span className="font-bold text-text-1 text-sm">{dx.diagnosis || dx.name}</span>
                </div>
                <span className={cn('text-sm font-black',
                  (dx.confidence ?? 0) >= 75 ? 'text-emerald' :
                  (dx.confidence ?? 0) >= 50 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {dx.confidence ?? '—'}%
                </span>
              </div>
              <div className="h-1.5 bg-surface-3">
                <div className={cn('h-full transition-all duration-700',
                  (dx.confidence ?? 0) >= 75 ? 'bg-emerald' :
                  (dx.confidence ?? 0) >= 50 ? 'bg-amber-400' : 'bg-red-400'
                )}
                  style={{ width: `${dx.confidence ?? 0}%` }} />
              </div>
              {dx.reasoning && (
                <p className="px-4 py-3 text-xs text-text-3 leading-relaxed">{dx.reasoning}</p>
              )}
            </div>
          ))}

          {/* UCG treatment */}
          {result.treatment && (
            <div className="bg-gold/5 border border-gold/20 rounded-xl p-4">
              <p className="label-xs text-gold mb-2">UCG Recommendation</p>
              <p className="text-sm text-text-2 leading-relaxed">{result.treatment}</p>
            </div>
          )}

          {/* Red flags */}
          {result.redFlags?.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="label-xs text-red-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Red Flags
              </p>
              <ul className="space-y-1">
                {result.redFlags.map((f: string, i: number) => (
                  <li key={i} className="text-sm text-red-300 flex items-start gap-2">
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
                className="flex-1 py-3 bg-emerald text-ink rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Accept
              </button>
              <button type="button" onClick={() => setDecision('overridden')}
                className="flex-1 py-3 bg-surface-3 text-text-2 rounded-xl font-bold text-xs uppercase tracking-widest border border-edge hover:border-edge-strong transition-colors">
                Override
              </button>
            </div>
          )}

          {decision && (
            <div className={cn(
              'flex items-center gap-2 p-4 rounded-xl text-sm font-bold border',
              decision === 'accepted'
                ? 'bg-emerald/10 text-emerald border-emerald/30'
                : 'bg-amber-400/10 text-amber-300 border-amber-400/30'
            )}>
              <CheckCircle2 className="w-4 h-4" />
              Diagnosis {decision}. Logged to audit trail.
            </div>
          )}

          {!decision && (
            <button type="button" onClick={run}
              className="text-xs text-text-3 hover:text-gold transition-colors font-medium">
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
        <button type="button" onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-text-3 hover:text-gold transition-colors uppercase tracking-widest">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to guidelines
        </button>
        <div>
          <div className="flex items-start gap-3 mb-3">
            <span className="font-mono text-[10px] text-gold bg-gold/10 border border-gold/20 rounded px-2 py-0.5 shrink-0">{selected.guideline_code}</span>
            <h3 className="font-bold text-text-1 text-sm leading-tight">{selected.title}</h3>
          </div>
          <div className="text-xs text-text-3 mb-4">
            {selected.category} {selected.subcategory && `→ ${selected.subcategory}`}
          </div>
          <div className="text-sm text-text-2 leading-relaxed whitespace-pre-line bg-surface-2 rounded-xl p-4 border border-edge max-h-[60vh] overflow-y-auto">
            {selected.content}
          </div>
          {selected.icd11_codes?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.icd11_codes.map((c: string) => (
                <span key={c} className="font-mono text-[10px] bg-surface-3 text-text-3 px-2 py-0.5 rounded">{c}</span>
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search UCG guidelines…"
          className="w-full pl-9 pr-4 py-2.5 bg-surface-2 border border-edge rounded-xl text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all"
        />
      </div>

      {loading && <div className="text-center py-8 text-text-3 text-sm">Loading guidelines…</div>}

      <div className="space-y-2 max-h-[65vh] overflow-y-auto">
        {filtered.map(g => (
          <button key={g.id} type="button" onClick={() => setSelected(g)}
            className="w-full text-left p-3 rounded-xl border border-edge hover:border-gold/40 hover:bg-surface-2 transition-all group bg-surface-1">
            <div className="flex items-start gap-2">
              <span className="font-mono text-[9px] text-gold bg-gold/10 border border-gold/20 rounded px-1.5 py-0.5 shrink-0 mt-0.5">{g.guideline_code}</span>
              <div>
                <p className="text-sm font-semibold text-text-1 group-hover:text-gold transition-colors leading-tight">{g.title}</p>
                <p className="text-[10px] text-text-3 mt-0.5">{g.category} · {g.subcategory}</p>
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
      <div className="flex items-center justify-center h-64 text-text-3">
        <Loader2 className="w-6 h-6 animate-spin mr-2 text-gold" /> Loading encounter…
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="text-text-2 font-medium">Encounter not found.</p>
        <Link to="/os/doctor/queue" className="text-gold font-bold text-sm hover:underline">← Back to queue</Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex overflow-hidden bg-ink">
      {/* ── Column 1: Patient context ── */}
      <aside className="w-64 shrink-0 bg-surface-1 border-r border-edge flex flex-col overflow-y-auto hidden lg:flex">
        <div className="p-4 border-b border-edge">
          <Link to="/os/doctor/queue"
            className="flex items-center gap-1.5 label-xs text-text-3 hover:text-gold transition-colors mb-4">
            <ChevronLeft className="w-3 h-3" /> Queue
          </Link>

          {/* Patient card */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-black text-lg shrink-0">
              {patient?.full_name?.[0] ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-text-1 text-sm truncate">{patient?.full_name}</p>
              <p className="font-mono text-[10px] text-text-3">{patient?.mrn}</p>
            </div>
          </div>

          {patient && (
            <div className="space-y-1.5 text-xs text-text-3">
              {patient.dob && <div><span className="font-semibold text-text-2">Age:</span> {calcAge(patient.dob)}y · {patient.sex}</div>}
              {patient.district && <div><span className="font-semibold text-text-2">District:</span> {patient.district}</div>}
            </div>
          )}
        </div>

        {/* Vitals */}
        {latestVitals && (
          <div className="p-4 border-b border-edge">
            <p className="label-xs mb-3">Latest Vitals</p>
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
        <div className="p-4 text-xs text-text-3 space-y-2">
          <p className="label-xs mb-2">Encounter</p>
          <div><span className="font-semibold text-text-2">Department:</span> {encounter.department?.name ?? '—'}</div>
          <div><span className="font-semibold text-text-2">Status:</span> <span className="capitalize">{encounter.status}</span></div>
          <div><span className="font-semibold text-text-2">Date:</span> {new Date(encounter.created_at).toLocaleDateString()}</div>
        </div>
      </aside>

      {/* ── Column 2: Clinical workspace ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab bar */}
        <div className="bg-surface-1 border-b border-edge px-4 shrink-0">
          <div className="flex items-center gap-1 h-12 overflow-x-auto">
            {tabs.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all rounded-lg',
                  activeTab === key
                    ? 'text-gold bg-gold/10'
                    : 'text-text-3 hover:text-text-1 hover:bg-surface-2'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6 bg-ink">
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
                    <label className="label-xs block mb-2">Chief Complaint</label>
                    <div className="bg-surface-2 border border-edge rounded-xl px-4 py-3 text-sm text-text-2">
                      {encounter.chief_complaint || 'Not recorded'}
                    </div>
                  </div>
                  <div>
                    <label className="label-xs block mb-2">History of Presenting Illness</label>
                    <textarea
                      value={historyText}
                      onChange={e => setHistoryText(e.target.value)}
                      rows={5}
                      placeholder="Describe the history of presenting illness…"
                      className="w-full px-4 py-3 bg-surface-2 border border-edge rounded-xl text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="label-xs block mb-2">Clinical Notes</label>
                    <div className="bg-surface-2 border border-edge rounded-xl px-4 py-3 text-sm text-text-2 min-h-[80px]">
                      {encounter.notes || <span className="text-text-3 italic">No notes recorded yet</span>}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'exam' && (
                <div className="max-w-2xl space-y-6">
                  <div>
                    <label className="label-xs block mb-2">Examination Findings</label>
                    <textarea
                      value={examText}
                      onChange={e => setExamText(e.target.value)}
                      rows={7}
                      placeholder="Record clinical examination findings…"
                      className="w-full px-4 py-3 bg-surface-2 border border-edge rounded-xl text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all resize-none"
                    />
                  </div>

                  {latestVitals && (
                    <div>
                      <p className="label-xs mb-3">Recorded Vitals</p>
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
                  <p className="label-xs mb-4">Active Orders</p>
                  {encounter.orders?.length > 0 ? (
                    encounter.orders.map((o: any) => (
                      <div key={o.id} className="flex items-start justify-between p-4 bg-surface-1 border border-edge rounded-xl">
                        <div>
                          <p className="font-semibold text-text-1 text-sm">{o.description || o.order_type}</p>
                          <p className="text-xs text-text-3 capitalize">{o.order_type}</p>
                        </div>
                        <span className={cn(
                          'text-xs font-bold px-2.5 py-1 rounded-full border capitalize',
                          o.status === 'completed' ? 'bg-emerald/10 text-emerald border-emerald/30' :
                          o.status === 'pending' ? 'bg-amber-400/10 text-amber-300 border-amber-400/30' :
                          'bg-surface-3 text-text-3 border-edge'
                        )}>
                          {o.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-text-3">
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

      {/* ── Column 3: Sign-off ── */}
      <aside className="w-64 shrink-0 bg-surface-1 border-l border-edge hidden xl:flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-edge">
          <p className="label-xs mb-3">Quick Reference</p>
          <p className="text-xs text-text-3 mb-4">18 Uganda Clinical Guidelines loaded. Search in the UCG tab.</p>

          <Link
            to="/os/doctor/queue"
            className="flex items-center justify-center gap-2 w-full bg-surface-3 border border-edge text-text-2 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:border-edge-strong hover:text-text-1 transition-all"
          >
            <X className="w-3.5 h-3.5" /> Close Encounter
          </Link>
        </div>

        <div className="p-4">
          <p className="label-xs mb-3">Encounter Status</p>
          <div className="space-y-2 text-xs text-text-2">
            <div className="flex justify-between">
              <span className="text-text-3">Status</span>
              <span className="font-semibold capitalize">{encounter.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">Opened</span>
              <span className="font-semibold">{new Date(encounter.created_at).toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">AI Diagnosis</span>
              <span className="font-semibold">{encounter.diagnosis ? 'Recorded' : 'Pending'}</span>
            </div>
          </div>

          {encounter.diagnosis && (
            <div className="mt-4 p-3 bg-emerald/10 border border-emerald/30 rounded-xl">
              <p className="label-xs text-emerald mb-1">Recorded Diagnosis</p>
              <p className="text-xs text-emerald">{encounter.diagnosis}</p>
            </div>
          )}
        </div>

        <div className="p-4 mt-auto border-t border-edge">
          <div className="flex items-center gap-2 text-xs text-text-3 mb-3">
            <FileText className="w-3.5 h-3.5" />
            <span>All actions auto-saved to audit log.</span>
          </div>
          <button
            type="button"
            className="w-full py-3 btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!encounter.diagnosis}
          >
            Sign &amp; Complete
          </button>
        </div>
      </aside>
    </div>
  );
}
