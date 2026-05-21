import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Clock, ArrowRight, RefreshCw, User, AlertTriangle, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { useDemoPatientQueue } from '../../hooks/useDemoData';
import { demoQueries } from '../../lib/supabase';

type TriageStatus = 'red' | 'yellow' | 'green';

const TRIAGE_CONFIG: Record<TriageStatus, { label: string; bar: string; badge: string; dot: string }> = {
  red:    { label: 'Immediate',  bar: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',    dot: 'bg-red-500' },
  yellow: { label: 'Urgent',    bar: 'bg-yellow-400',  badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400' },
  green:  { label: 'Routine',   bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

function calcAge(dob: string) {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function waitLabel(arrivedAt: string) {
  const mins = Math.floor((Date.now() - new Date(arrivedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function DoctorQueue() {
  const { patients, loading, error } = useDemoPatientQueue();
  const [encounters, setEncounters] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | TriageStatus>('all');
  const [selected, setSelected] = useState<any>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Load encounters keyed by patient_id
  useEffect(() => {
    if (patients.length === 0) return;
    Promise.all(
      patients.map(p =>
        demoQueries.getPatientEncounters(p.id).then(({ data }) => ({ id: p.id, enc: data?.[0] }))
      )
    ).then(results => {
      const map: Record<string, any> = {};
      results.forEach(({ id, enc }) => { if (enc) map[id] = enc; });
      setEncounters(map);
    });
  }, [patients]);

  const filtered = patients.filter(p => {
    const triage = (p.triage_status || 'green') as TriageStatus;
    const matchFilter = filter === 'all' || triage === filter;
    const matchSearch = !search ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.mrn?.toLowerCase().includes(search.toLowerCase()) ||
      p.district?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  }).sort((a, b) => {
    const order: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    return (order[a.triage_status] ?? 2) - (order[b.triage_status] ?? 2);
  });

  const counts = { red: 0, yellow: 0, green: 0 };
  patients.forEach(p => { const t = p.triage_status as TriageStatus; if (t in counts) counts[t]++; });

  return (
    <div className="h-[calc(100vh-8rem)] flex overflow-hidden bg-slate-50">
      {/* Queue list */}
      <div className={cn('flex flex-col flex-1 min-w-0 overflow-hidden', selected ? 'hidden lg:flex' : 'flex')}>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Patient Queue</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {loading ? 'Loading…' : `${filtered.length} of ${patients.length} patients`}
                {' · '}
                <span className="text-emerald-600 font-semibold">Live</span>
                {' · '}
                <span className="text-slate-400">Updated {lastRefreshed.toLocaleTimeString()}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLastRefreshed(new Date())}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              aria-label="Refresh queue"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, MRN, or district…"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
            />
          </div>

          {/* Triage filter */}
          <div className="flex gap-2">
            {(['all', 'red', 'yellow', 'green'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border',
                  filter === t
                    ? t === 'all' ? 'bg-slate-900 text-white border-slate-900'
                      : t === 'red' ? 'bg-red-500 text-white border-red-500'
                      : t === 'yellow' ? 'bg-yellow-400 text-slate-900 border-yellow-400'
                      : 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                )}
              >
                {t === 'all' ? `All (${patients.length})` : `${t} (${counts[t]})`}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <Activity className="w-5 h-5 animate-spin mr-2" /> Loading patients…
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <User className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No patients match your filters.</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {filtered.map(patient => {
              const triage = (patient.triage_status || 'green') as TriageStatus;
              const cfg = TRIAGE_CONFIG[triage];
              const enc = encounters[patient.id];
              const age = patient.dob ? calcAge(patient.dob) : '—';
              const wait = patient.arrived_at ? waitLabel(patient.arrived_at) : '—';

              return (
                <motion.button
                  key={patient.id}
                  type="button"
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onClick={() => setSelected(patient)}
                  className={cn(
                    'w-full text-left bg-white rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden flex',
                    selected?.id === patient.id ? 'border-emerald-400 shadow-md' : 'border-slate-200'
                  )}
                >
                  {/* Acuity stripe */}
                  <div className={cn('w-1 shrink-0', cfg.bar)} />

                  <div className="flex-1 px-4 py-4 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-sm truncate block">{patient.full_name}</span>
                        <span className="font-jb-mono text-xs text-slate-400">{patient.mrn}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border', cfg.badge)}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 mb-2">
                      {age}y · {patient.sex} · {patient.district || 'Unknown district'}
                    </div>

                    {enc?.chief_complaint && (
                      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mb-2 line-clamp-2">
                        {enc.chief_complaint}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span className="font-jb-mono">{wait}</span>
                      </div>
                      {patient.department?.name && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {patient.department.name}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Side panel */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key="panel"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full lg:w-96 bg-white border-l border-slate-200 flex flex-col overflow-hidden shrink-0"
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-slate-900">Patient Summary</h2>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">Close</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Patient identity */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xl font-black shrink-0">
                  {selected.full_name?.[0] ?? '?'}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{selected.full_name}</div>
                  <div className="font-jb-mono text-xs text-slate-400">{selected.mrn}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {selected.dob ? calcAge(selected.dob) : '—'}y · {selected.sex} · {selected.district}
                  </div>
                </div>
              </div>

              {/* Triage status */}
              {(() => {
                const triage = (selected.triage_status || 'green') as TriageStatus;
                const cfg = TRIAGE_CONFIG[triage];
                return (
                  <div className={cn('flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold', cfg.badge)}>
                    <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                    Triage: {cfg.label}
                  </div>
                );
              })()}

              {/* Chief complaint */}
              {encounters[selected.id]?.chief_complaint && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Chief Complaint</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3 leading-relaxed">
                    {encounters[selected.id].chief_complaint}
                  </p>
                </div>
              )}

              {/* Contact */}
              {selected.phone && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Phone</p>
                  <p className="font-jb-mono text-sm text-slate-700">{selected.phone}</p>
                </div>
              )}

              {/* Department */}
              {selected.department?.name && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Department</p>
                  <p className="text-sm text-slate-700">{selected.department.name}</p>
                </div>
              )}

              {/* Arrived */}
              {selected.arrived_at && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Wait Time</p>
                  <p className="font-jb-mono text-sm text-slate-700">{waitLabel(selected.arrived_at)}</p>
                </div>
              )}
            </div>

            {/* Open encounter CTA */}
            <div className="px-6 py-5 border-t border-slate-100 shrink-0">
              {encounters[selected.id] ? (
                <Link
                  to={`/os/doctor/encounter/${encounters[selected.id].id}`}
                  className="flex items-center justify-center gap-2 w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                >
                  Open Encounter <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <button type="button" disabled className="w-full bg-slate-100 text-slate-400 py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest cursor-not-allowed">
                  No Active Encounter
                </button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
