import React from 'react';
import { motion } from 'motion/react';
import {
  Video,
  Calendar,
  Clock,
  User,
  Activity,
  ChevronRight,
  Settings,
  Bell,
  Search,
  Filter
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';

export default function DoctorTele() {
  const appointments = [
    {
      id: '1',
      name: 'John Ssemwanga',
      age: '28M',
      symptoms: 'Fever, rigors, headache',
      triage: 'URGENT',
      time: '10:30 AM',
      status: 'upcoming'
    },
    {
      id: '2',
      name: 'Sarah Nakato',
      age: '34F',
      symptoms: 'Antenatal check-up',
      triage: 'ROUTINE',
      time: '2:15 PM',
      status: 'upcoming'
    }
  ];

  return (
    <div className="p-8 space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <Video className="w-5 h-5 text-synapse-primary" />
              <h1 className="text-3xl font-black uppercase tracking-tight">Telemedicine Dashboard</h1>
           </div>
           <p className="text-mono-xs text-neutral-600 uppercase tracking-widest">Manage Virtual Consultations & Queue</p>
        </div>

        <div className="flex items-center gap-4">
           <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Accepting Calls</span>
           </div>
           <button className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
              <Settings className="w-5 h-5 text-neutral-400" />
           </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Queue (2/3) */}
        <div className="lg:col-span-2 space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-mono-xs text-synapse-primary tracking-[0.3em]">Today's Appointments</h3>
              <div className="flex items-center gap-2">
                 <button className="text-[10px] font-black text-neutral-600 uppercase hover:text-white transition-colors px-2">Pending</button>
                 <button className="text-[10px] font-black text-white uppercase bg-white/5 px-2 py-1 rounded">Active</button>
              </div>
           </div>

           <div className="space-y-4">
              {appointments.map((apt, i) => (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="card p-6 hover:border-synapse-primary/30 transition-all group"
                >
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex gap-6">
                         <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            <Clock className="w-6 h-6 text-synapse-primary" />
                         </div>
                         <div className="space-y-1">
                            <div className="flex items-center gap-3">
                               <span className="text-lg font-black uppercase text-white tracking-tight">{apt.time}</span>
                               <div className={cn(
                                 "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                 apt.triage === 'URGENT' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                               )}>
                                  {apt.triage}
                               </div>
                            </div>
                            <div className="text-sm font-bold text-neutral-300">{apt.name} ({apt.age})</div>
                            <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-tight">{apt.symptoms}</div>
                         </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-center">
                         <button className="btn-secondary py-3 px-6 text-[10px] uppercase font-black tracking-widest">
                            Review SBAR
                         </button>
                         <Link to={`/tele/room/${apt.id}`} className="btn-primary py-3 px-6 text-[10px] uppercase font-black tracking-widest flex items-center gap-2">
                            Join Call <ChevronRight className="w-3 h-3" />
                         </Link>
                      </div>
                   </div>
                </motion.div>
              ))}
           </div>
        </div>

        {/* Sidebar (1/3) */}
        <aside className="space-y-8">
           <section className="space-y-6">
              <h3 className="text-mono-xs text-synapse-primary tracking-[0.3em]">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="card p-6 bg-white/5 flex flex-col gap-2">
                    <div className="text-2xl font-black text-white">08</div>
                    <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Completed</div>
                 </div>
                 <div className="card p-6 bg-white/5 flex flex-col gap-2">
                    <div className="text-2xl font-black text-synapse-primary">02</div>
                    <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Remaining</div>
                 </div>
              </div>
           </section>

           <section className="card p-8 bg-synapse-primary/5 border-synapse-primary/20 space-y-6">
              <div className="text-mono-xs text-synapse-primary">Availability</div>
              <p className="text-xs font-bold text-neutral-400 leading-relaxed uppercase">You are currently listed as available for telemedicine consultations at Mengo Hospital.</p>
              <button className="btn-secondary w-full py-4 text-[10px] font-black tracking-[0.2em] border-white/10">
                 GO OFFLINE
              </button>
           </section>
        </aside>
      </div>
    </div>
  );
}
