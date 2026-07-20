import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Video, Calendar, Clock, ChevronRight,
  CheckCircle2, Activity, ToggleLeft, ToggleRight,
  ShieldCheck, Search, Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function DoctorTeleDashboard() {
  const [isAvailable, setIsAvailable] = useState(true);

  const appointments = [
    { id: 'apt-1', patientName: 'John Ssemwanga', age: 28, gender: 'M', time: '10:30 AM', reason: 'Fever, rigors, headache', triage: 'URGENT', status: 'upcoming' },
    { id: 'apt-2', patientName: 'Sarah Nakato', age: 34, gender: 'F', time: '2:15 PM', reason: 'Antenatal check-up', triage: 'ROUTINE', status: 'upcoming' },
    { id: 'apt-3', patientName: 'Moses Kato', age: 45, gender: 'M', time: '4:00 PM', reason: 'Follow-up on hypertension', triage: 'ROUTINE', status: 'completed' },
  ];

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Video className="w-5 h-5 text-gold" />
            </div>
            <h1 className="font-display text-3xl font-black tracking-tight">
              Telemedicine <span className="text-gold">Dashboard</span>
            </h1>
          </div>
          <p className="text-text-3 font-medium tracking-tight">Manage your virtual consultations and availability.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className={cn(
            'px-4 py-3 rounded-xl border flex items-center gap-4 transition-all',
            isAvailable ? 'bg-emerald/10 border-emerald/30' : 'bg-surface-2 border-edge'
          )}>
            <div className="text-right">
              <p className="label-xs mb-0.5">Availability</p>
              <p className={cn('text-xs font-black uppercase tracking-widest', isAvailable ? 'text-emerald' : 'text-text-3')}>
                {isAvailable ? 'Online' : 'Offline'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAvailable(!isAvailable)}
              className="transition-colors"
            >
              {isAvailable
                ? <ToggleRight className="w-10 h-10 text-emerald" />
                : <ToggleLeft className="w-10 h-10 text-text-3" />
              }
            </button>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Today's Appointments */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="label-sm">Today's Schedule</h3>
            <div className="flex items-center gap-2 label-xs">
              <Calendar className="w-3 h-3" /> Monday, 28 April 2026
            </div>
          </div>

          <div className="space-y-4">
            {appointments.map((apt, i) => (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={cn(
                  'card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all',
                  apt.status === 'completed' ? 'opacity-50' : 'hover:border-gold/30'
                )}
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-xl font-black text-gold">
                    {apt.patientName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-base font-bold text-text-1">{apt.patientName}</h4>
                      <span className="text-[10px] font-bold text-text-3 uppercase tracking-widest bg-surface-3 px-2 py-0.5 rounded-md border border-edge">
                        {apt.age}{apt.gender}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 label-xs">
                      <span className="flex items-center gap-1.5 text-text-3">
                        <Clock className="w-3 h-3 text-gold" /> {apt.time}
                      </span>
                      <span className={cn(
                        'px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest',
                        apt.triage === 'URGENT'
                          ? 'bg-amber-400/10 border-amber-400/20 text-amber-300'
                          : 'bg-emerald/10 border-emerald/30 text-emerald'
                      )}>
                        {apt.triage}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-text-3 mt-2 italic">"{apt.reason}"</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {apt.status === 'upcoming' ? (
                    <Link
                      to={`/tele/room/${apt.id}`}
                      className="btn-primary py-3 px-6 text-[10px] flex items-center gap-2 group/btn"
                    >
                      Join Call <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  ) : (
                    <div className="px-6 py-3 rounded-xl border border-edge bg-surface-2 label-xs text-text-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Completed
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Stats & Tools */}
        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="label-sm">Performance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-5 space-y-1">
                <p className="label-xs">Consults</p>
                <p className="font-display text-2xl font-black text-text-1">12</p>
                <p className="text-[9px] font-bold text-emerald uppercase tracking-widest">+20% vs LW</p>
              </div>
              <div className="card p-5 space-y-1">
                <p className="label-xs">Rating</p>
                <p className="font-display text-2xl font-black text-text-1">4.9</p>
                <p className="text-[9px] font-bold text-emerald uppercase tracking-widest">Excellent</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="label-sm">Telemedicine Tools</h3>
            <div className="space-y-3">
              {[
                { icon: ShieldCheck, label: 'DPA Compliance Audit' },
                { icon: Settings, label: 'Room Configuration' },
                { icon: Search, label: 'View Archived Logs' },
              ].map((tool, i) => (
                <button key={i} type="button"
                  className="w-full card p-4 flex items-center gap-4 hover:border-gold/30 hover:bg-surface-2 transition-all text-left group">
                  <div className="w-8 h-8 rounded-lg bg-surface-3 border border-edge flex items-center justify-center group-hover:border-gold/40 transition-colors">
                    <tool.icon className="w-4 h-4 text-text-3 group-hover:text-gold transition-colors" />
                  </div>
                  <span className="label-xs text-text-2 group-hover:text-text-1 transition-colors">{tool.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="p-6 rounded-2xl bg-gold/5 border border-gold/20 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gold" />
              <span className="label-xs text-gold">Network Status</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-text-3 uppercase">LiveKit Cluster</span>
                <span className="text-emerald uppercase tracking-widest">Operational</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-text-3 uppercase">Latency (ug-kmp)</span>
                <span className="text-text-1 font-mono">12ms</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
