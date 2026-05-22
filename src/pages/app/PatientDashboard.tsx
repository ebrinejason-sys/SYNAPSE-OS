import { motion } from 'motion/react';
import { User, Bell, Calendar, FileText, Activity, ShieldCheck, ArrowRight, HeartPulse, Pill } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SynapseIcon } from '../../components/ui/SynapseLogo';

export default function PatientDashboard() {
  return (
    <div className="min-h-screen bg-ink flex justify-center text-text-1">
      {/* PWA Container - Mimics Mobile App on Desktop */}
      <div className="w-full max-w-md bg-ink min-h-screen shadow-2xl relative flex flex-col border-x border-edge">

        {/* Header */}
        <header className="px-6 pt-12 pb-6 bg-surface-1 rounded-b-[2.5rem] border-b border-edge">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <SynapseIcon size={48} className="rounded-2xl" />
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight">Health OS</h1>
                <p className="label-xs">Synced with Mengo Hospital</p>
              </div>
            </div>
            <button type="button" aria-label="Notifications" className="relative p-2 bg-surface-2 rounded-xl border border-edge hover:bg-surface-3 transition-colors">
              <Bell className="w-5 h-5 text-text-3" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red rounded-full border-2 border-surface-1" />
            </button>
          </div>

          <div className="glass p-4 rounded-3xl border border-edge flex items-center gap-4">
            <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center text-gold border border-gold/20">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <p className="label-xs text-gold mb-1">Active Vitals</p>
              <p className="text-lg font-black tracking-tight">82 BPM <span className="text-[10px] font-bold text-text-3 uppercase ml-2 tracking-widest">Normal Range</span></p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 pt-8 space-y-8 overflow-y-auto pb-24">
          {/* Section: Next Appointment */}
          <section>
            <h2 className="label-xs mb-4">Upcoming Visit</h2>
            <div className="p-6 bg-surface-2 rounded-[2rem] border border-edge flex items-center gap-4 group hover:border-gold/30 transition-colors cursor-pointer">
              <div className="w-14 h-14 bg-gold/10 rounded-2xl flex flex-col items-center justify-center border border-gold/20 transition-transform group-hover:scale-105">
                <span className="label-xs">MAY</span>
                <span className="text-xl font-black text-gold">08</span>
              </div>
              <div className="flex-1">
                <h3 className="font-black text-text-1 uppercase tracking-tight text-sm">Follow-up: Lab Review</h3>
                <p className="label-xs mt-0.5 mb-2">Dr. Okello · Mengo Hospital</p>
                <div className="flex items-center gap-1.5 label-xs text-emerald">
                  <ShieldCheck className="w-3.5 h-3.5" /> Insurance Approved
                </div>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="grid grid-cols-2 gap-4">
            <button type="button" className="p-6 bg-surface-2 rounded-[2rem] border border-edge flex flex-col gap-4 group hover:border-gold/50 transition-all hover:bg-gold/5">
              <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center text-gold transition-transform group-hover:scale-110">
                <Calendar className="w-6 h-6" />
              </div>
              <span className="label-xs text-text-3 group-hover:text-text-1 transition-colors">Book Visit</span>
            </button>
            <button type="button" className="p-6 bg-surface-2 rounded-[2rem] border border-edge flex flex-col gap-4 group hover:border-blue/50 transition-all hover:bg-blue/5">
              <div className="w-10 h-10 bg-blue/10 rounded-xl flex items-center justify-center text-blue transition-transform group-hover:scale-110">
                <Pill className="w-6 h-6" />
              </div>
              <span className="label-xs text-text-3 group-hover:text-text-1 transition-colors">Prescriptions</span>
            </button>
          </section>

          {/* Latest Records */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="label-xs">Recent Activity</h2>
              <button type="button" className="label-xs text-gold hover:underline">View All</button>
            </div>
            <div className="space-y-3">
              {[
                { title: 'Lab Result: Malaria RDT', date: 'Yesterday', type: 'Lab', status: 'Available' },
                { title: 'Visit Summary: OPD', date: '3 days ago', type: 'Visit', status: 'Signed' }
              ].map((rec, i) => (
                <div key={i} className="p-5 bg-surface-2 rounded-2xl border border-edge flex items-center gap-4 group hover:border-edge-strong transition-colors cursor-pointer">
                  <div className="w-10 h-10 bg-surface-3 rounded-xl flex items-center justify-center text-text-3 transition-colors group-hover:text-text-2">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-black text-text-1 uppercase tracking-tight">{rec.title}</h4>
                    <p className="label-xs">{rec.date} · {rec.type}</p>
                  </div>
                  <div className="text-gold opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* Bottom Nav */}
        <nav className="absolute bottom-0 w-full h-20 bg-surface-1/80 backdrop-blur-md border-t border-edge flex items-center justify-around px-4 pb-4">
          {[
            { icon: Activity, label: 'Health' },
            { icon: Calendar, label: 'Visits' },
            { icon: FileText, label: 'Vault' },
            { icon: User, label: 'Profile' }
          ].map((nav, i) => (
            <button key={i} type="button" className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              i === 0 ? "text-gold" : "text-text-3 hover:text-text-2"
            )}>
              <nav.icon className="w-6 h-6 transition-transform hover:scale-110" />
              <span className="label-xs scale-[0.8]">{nav.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
