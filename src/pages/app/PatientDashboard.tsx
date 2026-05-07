import { motion } from 'motion/react';
import { User, Bell, Calendar, FileText, Activity, ShieldCheck, ArrowRight, HeartPulse, Pill } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PatientDashboard() {
  return (
    <div className="min-h-screen bg-synapse-black flex justify-center text-white selection:bg-synapse-primary/30 selection:text-cyan-200">
      {/* PWA Container - Mimics Mobile App on Desktop */}
      <div className="w-full max-w-md bg-synapse-black min-h-screen shadow-2xl relative flex flex-col border-x border-white/5">
        
        {/* Header */}
        <header className="px-6 pt-12 pb-6 bg-synapse-dark rounded-b-[2.5rem] border-b border-white/5">
           <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-12 h-12 bg-synapse-primary rounded-2xl flex items-center justify-center text-xl font-black text-synapse-black shadow-lg shadow-cyan-500/20 transition-transform hover:scale-105">S</div>
                 <div>
                    <h1 className="text-xl font-black uppercase tracking-tight">Health OS</h1>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Synced with Mengo Hospital</p>
                 </div>
              </div>
              <button className="relative p-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                 <Bell className="w-5 h-5 text-neutral-400" />
                 <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-synapse-dark"></span>
              </button>
           </div>

           <div className="glass p-4 rounded-3xl border border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 bg-synapse-primary/10 rounded-2xl flex items-center justify-center text-synapse-primary border border-synapse-primary/20">
                 <HeartPulse className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-mono-xs text-synapse-primary mb-1">Active Vitals</p>
                 <p className="text-lg font-black tracking-tight">82 BPM <span className="text-[10px] font-bold text-neutral-500 uppercase ml-2 tracking-widest">Normal Range</span></p>
              </div>
           </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 pt-8 space-y-8 overflow-y-auto pb-24">
           {/* Section: Next Appointment */}
           <section>
              <h2 className="text-mono-xs text-neutral-600 mb-4">Upcoming Visit</h2>
              <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5 flex items-center gap-4 group hover:border-synapse-primary/30 transition-colors cursor-pointer">
                 <div className="w-14 h-14 bg-synapse-primary/10 rounded-2xl flex flex-col items-center justify-center border border-synapse-primary/20 transition-transform group-hover:scale-105">
                    <span className="text-mono-xs text-neutral-500">MAY</span>
                    <span className="text-xl font-black text-synapse-primary">08</span>
                 </div>
                 <div className="flex-1">
                    <h3 className="font-black text-white uppercase tracking-tight text-sm">Follow-up: Lab Review</h3>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5 mb-2">Dr. Okello · Mengo Hospital</p>
                    <div className="flex items-center gap-1.5 text-mono-xs text-emerald-500">
                       <ShieldCheck className="w-3.5 h-3.5" /> Insurance Approved
                    </div>
                 </div>
              </div>
           </section>

           {/* Quick Actions */}
           <section className="grid grid-cols-2 gap-4">
              <button className="p-6 bg-white/5 rounded-[2rem] border border-white/5 flex flex-col gap-4 group hover:border-synapse-primary/50 transition-all hover:bg-synapse-primary/5">
                 <div className="w-10 h-10 bg-synapse-primary/10 rounded-xl flex items-center justify-center text-synapse-primary transition-transform group-hover:scale-110">
                   <Calendar className="w-6 h-6" />
                 </div>
                 <span className="text-mono-xs text-neutral-400 group-hover:text-white transition-colors">Book Visit</span>
              </button>
              <button className="p-6 bg-white/5 rounded-[2rem] border border-white/5 flex flex-col gap-4 group hover:border-synapse-primary/50 transition-all hover:bg-synapse-primary/5">
                 <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-400 transition-transform group-hover:scale-110">
                   <Pill className="w-6 h-6" />
                 </div>
                 <span className="text-mono-xs text-neutral-400 group-hover:text-white transition-colors">Prescriptions</span>
              </button>
           </section>

           {/* Latest Records */}
           <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-mono-xs text-neutral-600">Recent Activity</h2>
                <button className="text-mono-xs text-synapse-primary hover:underline">View All</button>
              </div>
              <div className="space-y-3">
                 {[
                   { title: 'Lab Result: Malaria RDT', date: 'Yesterday', type: 'Lab', status: 'Available' },
                   { title: 'Visit Summary: OPD', date: '3 days ago', type: 'Visit', status: 'Signed' }
                 ].map((rec, i) => (
                   <div key={i} className="p-5 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4 group hover:border-white/10 transition-colors cursor-pointer">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-neutral-600 transition-colors group-hover:text-neutral-300">
                         <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                         <h4 className="text-sm font-black text-white uppercase tracking-tight">{rec.title}</h4>
                         <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">{rec.date} · {rec.type}</p>
                      </div>
                      <div className="text-synapse-primary opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">
                         <ArrowRight className="w-4 h-4" />
                      </div>
                   </div>
                 ))}
              </div>
           </section>
        </main>

        {/* Bottom Nav */}
        <nav className="absolute bottom-0 w-full h-20 bg-synapse-dark/80 backdrop-blur-md border-t border-white/5 flex items-center justify-around px-4 pb-4">
           {[
             { icon: Activity, label: 'Health' },
             { icon: Calendar, label: 'Visits' },
             { icon: FileText, label: 'Vault' },
             { icon: User, label: 'Profile' }
           ].map((nav, i) => (
             <button key={i} className={cn(
               "flex flex-col items-center gap-1 transition-colors",
               i === 0 ? "text-synapse-primary" : "text-neutral-600 hover:text-neutral-400"
             )}>
                <nav.icon className="w-6 h-6 transition-transform hover:scale-110" />
                <span className="text-mono-xs scale-[0.8]">{nav.label}</span>
             </button>
           ))}
        </nav>
      </div>
    </div>
  );
}
