import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Clock, ArrowRight, RefreshCw, User, AlertTriangle, Activity, Stethoscope } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { useDemoPatientQueue } from '../../hooks/useDemoData';
import { demoQueries } from '../../lib/supabase';

type Triage = 'red' | 'yellow' | 'green';

const TRIAGE: Record<Triage, { label: string; stripe: string; badge: string; dot: string; ring: string }> = {
  red:    { label: 'Immediate', stripe: 'bg-red-500',    badge: 'bg-red-500/10 text-red-400 border-red-500/20',    dot: 'bg-red-400',    ring: 'border-red-500/40' },
  yellow: { label: 'Urgent',    stripe: 'bg-amber-400',  badge: 'bg-amber-400/10 text-amber-300 border-amber-400/20', dot: 'bg-amber-400', ring: 'border-amber-400/40' },
  green:  { label: 'Routine',   stripe: 'bg-emerald',    badge: 'bg-emerald/10 text-emerald border-emerald/20',    dot: 'bg-emerald',    ring: 'border-emerald/30' },
};

function ageFromDob(dob: string) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function waitLabel(arrivedAt: string) {
  const mins = Math.floor((Date.now() - new Date(arrivedAt).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function DoctorQueue() {
  const { patients, loading, error } = useDemoPatientQueue();
  const [encounters, setEncounters] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Triage>('all');
  const [selected, setSelected] = useState<any>(null);
  const [refreshed, setRefreshed] = useState(new Date());

  useEffect(() => {
    if (!patients.length) return;
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

  const counts = { red: 0, yellow: 0, green: 0 };
  patients.forEach(p => { const t = p.triage_status as Triage; if (t in counts) counts[t]++; });

  const filtered = patients
    .filter(p => {
      const t = (p.triage_status || 'green') as Triage;
      const matchFilter = filter === 'all' || t === filter;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.full_name?.toLowerCase().includes(q) ||
        p.mrn?.toLowerCase().includes(q) ||
        p.district?.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    })
    .sort((a, b) => ({ red: 0, yellow: 1, green: 2 }[a.triage_status] ?? 2) - ({ red: 0, yellow: 1, green: 2 }[b.triage_status] ?? 2));

  return (
    <div className="h-[calc(100vh-7rem)] flex overflow-hidden bg-ink">
      {/* ── Queue list ─────────────────────────────────────────────────────── */}
      <div className={cn('flex flex-col flex-1 min-w-0 overflow-hidden', selected ? 'hidden lg:flex' : 'flex')}>

        {/* Header */}
        <div className="bg-surface-1 border-b border-edge px-6 py-5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-xl font-bold text-text-1 tracking-tight">Patient Queue</h1>
              <p className="text-xs text-text-3 mt-0.5 font-mono">
                {loading ? 'Loading…' : `${filtered.length} / ${patients.length} patients`}
                {' · '}
                <span className="text-emerald font-bold">● Live</span>
                {' · '}
                {refreshed.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => setRefreshed(new Date())}
              className="p-2.5 rounded-xl border border-edge hover:border-edge-strong hover:bg-surface-2 transition-all"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-text-3" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, MRN, district…"
              className="w-full pl-10 pr-4 py-2.5 bg-surface-2 border border-edge rounded-xl text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all font-body"
            />
          </div>

          {/* Triage filters */}
          <div className="flex gap-2">
            {(['all', 'red', 'yellow', 'green'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border',
                  filter === t
                    ? t === 'all'    ? 'bg-gold text-ink border-gold'
                    : t === 'red'    ? 'bg-red-500 text-white border-red-500'
                    : t === 'yellow' ? 'bg-amber-400 text-ink border-amber-400'
                    :                  'bg-emerald text-ink border-emerald'
                    : 'bg-surface-2 text-text-3 border-edge hover:border-edge-strong'
                )}
              >
                {t === 'all' ? `All (${patients.length})` : `${t} (${counts[t]})`}
              </button>
            ))}
          </div>
        </div>

        {/* Patient list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-24 text-text-3">
              <Activity className="w-5 h-5 animate-spin mr-2 text-gold" />
              <span className="text-sm">Loading patients…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-text-3">
              <User className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-sm">No patients match your filters.</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {filtered.map(patient => {
              const triage = (patient.triage_status || 'green') as Triage;
              const cfg = TRIAGE[triage];
              const enc = encounters[patient.id];
              const age = patient.dob ? ageFromDob(patient.dob) : '—';
              const wait = patient.arrived_at ? waitLabel(patient.arrived_at) : '—';
              const isSelected = selected?.id === patient.id;

              return (
                <motion.button
                  key={patient.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  onClick={() => setSelected(patient)}
                  className={cn(
                    'w-full text-left rounded-2xl border overflow-hidden flex transition-all duration-200',
                    isSelected
                      ? 'border-gold bg-surface-2 shadow-[0_0_0_1px_rgba(232,184,75,0.2)]'
                      : 'bg-surface-1 border-edge hover:border-edge-strong hover:bg-surface-2 hover:-translate-y-0.5'
                  )}
                >
                  {/* Triage stripe */}
                  <div className={cn('w-1 shrink-0', cfg.stripe)} />

                  <div className="flex-1 px-4 py-4 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <span className="font-display font-bold text-text-1 text-sm truncate block">{patient.full_name}</span>
                        <span className="font-mono text-xs text-text-3">{patient.mrn}</span>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0', cfg.badge)}>
                        {cfg.label}
                      </span>
                    </div>

                    <p className="text-xs text-text-3 mb-2">
                      {age}y · {patient.sex} · {patient.district || 'Unknown'}
                    </p>

                    {enc?.chief_complaint && (
                      <p className="text-xs text-text-2 bg-surface-3 rounded-lg px-3 py-2 mb-2 line-clamp-2 italic">
                        "{enc.chief_complaint}"
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-text-3">
                        <Clock className="w-3 h-3" />
                        <span className="font-mono">{wait}</span>
                      </div>
                      {patient.department?.name && (
                        <span className="label-xs">{patient.department.name}</span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Side panel ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.aside
            key="panel"
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="w-full lg:w-96 bg-surface-1 border-l border-edge flex flex-col overflow-hidden shrink-0"
          >
            {/* Panel header */}
            <div className="px-6 py-4 border-b border-edge flex items-center justify-between shrink-0">
              <h2 className="font-display font-bold text-text-1 text-sm uppercase tracking-widest">Patient Summary</h2>
              <button onClick={() => setSelected(null)} className="text-xs font-bold text-text-3 hover:text-text-1 transition-colors uppercase tracking-widest">
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Avatar + Identity */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold text-xl font-black font-display shrink-0">
                  {selected.full_name?.[0] ?? '?'}
                </div>
                <div>
                  <p className="font-display font-bold text-text-1">{selected.full_name}</p>
                  <p className="font-mono text-xs text-text-3 mt-0.5">{selected.mrn}</p>
                  <p className="text-xs text-text-3 mt-0.5">
                    {selected.dob ? ageFromDob(selected.dob) : '—'}y · {selected.sex} · {selected.district}
                  </p>
                </div>
              </div>

              {/* Triage status */}
              {(() => {
                const t = (selected.triage_status || 'green') as Triage;
                const cfg = TRIAGE[t];
                return (
                  <div className={cn('flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-bold', cfg.badge)}>
                    <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                    Triage: {cfg.label}
                  </div>
                );
              })()}

              {/* Chief complaint */}
              {encounters[selected.id]?.chief_complaint && (
                <div>
                  <p className="label-xs mb-2">Chief Complaint</p>
                  <p className="text-sm text-text-2 bg-surface-2 rounded-xl px-4 py-3 leading-relaxed italic border border-edge">
                    "{encounters[selected.id].chief_complaint}"
                  </p>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                {selected.phone && (
                  <div className="bg-surface-2 rounded-xl px-4 py-3 border border-edge">
                    <p className="label-xs mb-1">Phone</p>
                    <p className="font-mono text-sm text-text-1">{selected.phone}</p>
                  </div>
                )}
                {selected.arrived_at && (
                  <div className="bg-surface-2 rounded-xl px-4 py-3 border border-edge">
                    <p className="label-xs mb-1">Wait Time</p>
                    <p className="font-mono text-sm text-text-1">{waitLabel(selected.arrived_at)}</p>
                  </div>
                )}
                {selected.department?.name && (
                  <div className="bg-surface-2 rounded-xl px-4 py-3 border border-edge col-span-2">
                    <p className="label-xs mb-1">Department</p>
                    <p className="text-sm text-text-1">{selected.department.name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="px-6 py-4 border-t border-edge shrink-0">
              {encounters[selected.id] ? (
                <Link
                  to={`/os/doctor/encounter/${encounters[selected.id].id}`}
                  className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2"
                >
                  <Stethoscope className="w-4 h-4" />
                  Open Encounter
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <button disabled className="btn-primary w-full py-3.5 text-sm opacity-30 cursor-not-allowed">
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
