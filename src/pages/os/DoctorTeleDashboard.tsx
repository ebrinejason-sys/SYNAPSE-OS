import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Video,
  Calendar,
  Clock,
  User,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Activity,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Search,
  Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function DoctorTeleDashboard() {
  const [isAvailable, setIsAvailable] = useState(true);

  const appointments = [
    {
      id: 'apt-1',
      patientName: 'John Ssemwanga',
      age: 28,
      gender: 'M',
      time: '10:30 AM',
      reason: 'Fever, rigors, headache',
      triage: 'URGENT',
      status: 'upcoming'
    },
    {
      id: 'apt-2',
      patientName: 'Sarah Nakato',
      age: 34,
      gender: 'F',
      time: '2:15 PM',
      reason: 'Antenatal check-up',
      triage: 'ROUTINE',
      status: 'upcoming'
    },
    {
      id: 'apt-3',
      patientName: 'Moses Kato',
      age: 45,
      gender: 'M',
      time: '4:00 PM',
      reason: 'Follow-up on hypertension',
      triage: 'ROUTINE',
      status: 'completed'
    }
  ];

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-synapse-primary/10 border border-synapse-primary/20 flex items-center justify-center">
                 <Video className="w-5 h-5 text-synapse-primary" />
              </div>
              <h1 className="text-3xl font-black tracking-tight">Telemedicine <span className="text-synapse-primary">Dashboard</span></h1>
           </div>
           <p className="text-neutral-500 font-medium tracking-tight">Manage your virtual consultations and availability.</p>
        </div>

        <div className="flex items-center gap-4">
           <div className={cn(
             "px-4 py-3 rounded-xl border flex items-center gap-4 transition-all",
             isAvailable ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/5 border-white/10"
           )}>
              <div className="text-right">
                 <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-0.5">Availability</p>
                 <p className={cn("text-xs font-black uppercase tracking-widest", isAvailable ? "text-emerald-500" : "text-neutral-500")}>
                   {isAvailable ? 'Online' : 'Offline'}
                 </p>
              </div>
              <button
                onClick={() => setIsAvailable(!isAvailable)}
                className="text-white hover:text-synapse-primary transition-colors"
              >
                {isAvailable ? <ToggleRight className="w-10 h-10 text-emerald-500" /> : <ToggleLeft className="w-10 h-10 text-neutral-600" />}
              </button>
           </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
         {/* Today's Appointments */}
         <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Today's Schedule</h3>
               <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                  <Calendar className="w-3 h-3" /> Monday, 28 April 2026
               </div>
            </div>

            <div className="space-y-4">
               {appointments.map((apt) => (
                 <div key={apt.id} className={cn(
                   "card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all group",
                   apt.status === 'completed' ? "opacity-60" : "hover:border-synapse-primary/30"
                 )}>
                    <div className="flex items-center gap-5">
                       <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl font-black text-synapse-primary group-hover:border-synapse-primary/50 transition-colors">
                          {apt.patientName.charAt(0)}
                       </div>
                       <div>
                          <div className="flex items-center gap-3 mb-1">
                             <h4 className="text-base font-bold text-white">{apt.patientName}</h4>
                             <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                {apt.age}{apt.gender}
                             </span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                             <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-synapse-primary" /> {apt.time}</span>
                             <span className={cn(
                               "px-2 py-0.5 rounded border",
                               apt.triage === 'URGENT' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                             )}>{apt.triage}</span>
                          </div>
                          <p className="text-[11px] font-medium text-neutral-400 mt-2 italic">"{apt.reason}"</p>
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
                         <button className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                           <CheckCircle2 className="w-4 h-4" /> Completed
                         </button>
                       )}
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Stats & Tools */}
         <div className="space-y-8">
            <section className="space-y-4">
               <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Performance</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="card p-5 space-y-1">
                     <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Consults</p>
                     <p className="text-2xl font-black text-white">12</p>
                     <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">+20% vs LW</p>
                  </div>
                  <div className="card p-5 space-y-1">
                     <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Patient Rating</p>
                     <p className="text-2xl font-black text-white">4.9</p>
                     <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Excellent</p>
                  </div>
               </div>
            </section>

            <section className="space-y-4">
               <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Telemedicine Tools</h3>
               <div className="space-y-3">
                  {[
                    { icon: ShieldCheck, label: 'DPA Compliance Audit' },
                    { icon: Settings, label: 'Room Configuration' },
                    { icon: Search, label: 'View Archived Logs' },
                  ].map((tool, i) => (
                    <button key={i} className="w-full card p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left group">
                       <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-synapse-primary/50 transition-colors">
                          <tool.icon className="w-4 h-4 text-neutral-500 group-hover:text-synapse-primary transition-colors" />
                       </div>
                       <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">{tool.label}</span>
                    </button>
                  ))}
               </div>
            </section>

            <section className="p-6 rounded-2xl bg-synapse-primary/5 border border-synapse-primary/20 space-y-4">
               <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-synapse-primary" />
                  <span className="text-[10px] font-black text-synapse-primary uppercase tracking-widest">Network Status</span>
               </div>
               <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                     <span className="text-neutral-500 uppercase">LiveKit Cluster</span>
                     <span className="text-emerald-500 uppercase tracking-widest">Operational</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                     <span className="text-neutral-500 uppercase">Latency (ug-kmp)</span>
                     <span className="text-white">12ms</span>
                  </div>
               </div>
            </section>
         </div>
      </div>
    </div>
  );
}
