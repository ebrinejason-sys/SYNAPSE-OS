import { motion } from 'motion/react';
import { User, Bell, Calendar, FileText, Activity, ShieldCheck, ArrowRight, HeartPulse, Pill } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SynapseIcon } from '../../components/ui/SynapseLogo';

export default function PatientDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* PWA Container - Mimics Mobile App on Desktop */}
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative flex flex-col">
        
        {/* Header */}
        <header className="px-6 pt-12 pb-6 bg-[#0F172A] text-white rounded-b-[2.5rem]">
           <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                 <SynapseIcon size={48} className="rounded-2xl" />
                 <div>
                    <h1 className="text-xl font-bold">Health Dashboard</h1>
                    <p className="text-xs text-gray-400 font-medium">Synced with Mengo Hospital</p>
                 </div>
              </div>
              <button className="relative p-2 bg-white/10 rounded-xl">
                 <Bell className="w-5 h-5" />
                 <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border-2 border-[#0F172A]"></span>
              </button>
           </div>

           <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white">
                 <HeartPulse className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Active Vitals</p>
                 <p className="text-lg font-bold">82 BPM <span className="text-xs font-normal text-gray-300 ml-2">Normal Range</span></p>
              </div>
           </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 pt-8 space-y-8 overflow-y-auto pb-24">
           {/* Section: Next Appointment */}
           <section>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Upcoming Visit</h2>
              <div className="p-6 bg-green-50 rounded-[2rem] border border-green-100 flex items-center gap-4">
                 <div className="w-14 h-14 bg-white rounded-2xl flex flex-col items-center justify-center shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">MAY</span>
                    <span className="text-xl font-bold text-green-600">08</span>
                 </div>
                 <div className="flex-1">
                    <h3 className="font-bold text-gray-900">Follow-up: Lab Review</h3>
                    <p className="text-xs text-gray-500 font-medium mb-2">Dr. Okello · Mengo Hospital</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 uppercase">
                       <ShieldCheck className="w-3 h-3" /> Insurance Pre-Approved
                    </div>
                 </div>
              </div>
           </section>

           {/* Quick Actions */}
           <section className="grid grid-cols-2 gap-4">
              <button className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 flex flex-col gap-4 group hover:border-green-300 transition-all">
                 <Calendar className="w-6 h-6 text-green-600" />
                 <span className="font-bold text-sm text-gray-700">Book Visit</span>
              </button>
              <button className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 flex flex-col gap-4 group hover:border-green-300 transition-all">
                 <Pill className="w-6 h-6 text-blue-600" />
                 <span className="font-bold text-sm text-gray-700">Prescriptions</span>
              </button>
           </section>

           {/* Latest Records */}
           <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Recent Activity</h2>
                <button className="text-xs font-bold text-green-600">View All</button>
              </div>
              <div className="space-y-3">
                 {[
                   { title: 'Lab Result: Malaria RDT', date: 'Yesterday', type: 'Lab', status: 'Available' },
                   { title: 'Visit Summary: OPD', date: '3 days ago', type: 'Visit', status: 'Signed' }
                 ].map((rec, i) => (
                   <div key={i} className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                         <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                         <h4 className="text-sm font-bold text-gray-900">{rec.title}</h4>
                         <p className="text-[10px] text-gray-400 font-medium">{rec.date} · {rec.type}</p>
                      </div>
                      <div className="text-green-600">
                         <ArrowRight className="w-4 h-4" />
                      </div>
                   </div>
                 ))}
              </div>
           </section>
        </main>

        {/* Bottom Nav */}
        <nav className="absolute bottom-0 w-full h-20 bg-white border-t border-gray-100 flex items-center justify-around px-4 pb-4">
           {[
             { icon: Activity, label: 'Health' },
             { icon: Calendar, label: 'Visits' },
             { icon: FileText, label: 'Vault' },
             { icon: User, label: 'Profile' }
           ].map((nav, i) => (
             <button key={i} className={cn(
               "flex flex-col items-center gap-1",
               i === 0 ? "text-green-600" : "text-gray-400"
             )}>
                <nav.icon className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{nav.label}</span>
             </button>
           ))}
        </nav>
      </div>
    </div>
  );
}
