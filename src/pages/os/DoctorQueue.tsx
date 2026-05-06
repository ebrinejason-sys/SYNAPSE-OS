import { motion } from 'motion/react';
import { Search, Filter, MoreVertical, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { DEMO_QUEUE } from '../../constants';
import { cn, formatTime } from '../../lib/utils';
import { Link } from 'react-router-dom';

export default function DoctorQueue() {
  return (
    <div className="max-w-6xl mx-auto p-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Patient Queue</h1>
          <p className="text-slate-500 text-sm font-medium">Monitoring {DEMO_QUEUE.length} active outpatient encounters</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search MRN or name..." 
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-64 shadow-sm"
            />
          </div>
          <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </header>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {DEMO_QUEUE.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="group"
          >
            <Link to={`/os/doctor/encounter/${item.patientId}`}>
              <article className="bg-white p-6 rounded-[1.5rem] border border-slate-200 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/5 transition-all cursor-pointer relative overflow-hidden shadow-sm">
                <div className={cn(
                  "absolute top-0 left-0 w-1.5 h-full",
                  item.acuity === 'RED' ? 'bg-red-500' :
                  item.acuity === 'YELLOW' ? 'bg-amber-400' : 'bg-emerald-500'
                )} />
                
                <div className="flex justify-between items-start mb-5 pl-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                      item.acuity === 'RED' ? 'bg-red-50 text-red-700' :
                      item.acuity === 'YELLOW' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    )}>
                      {item.acuity} Priority
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.id}</span>
                  </div>
                  <button className="p-1 hover:bg-slate-50 rounded text-slate-400">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                <div className="pl-2">
                  <h3 className="text-xl font-bold mb-1 text-slate-900 group-hover:text-emerald-700 transition-colors">{item.patientName}</h3>
                  <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500 mb-6 uppercase tracking-wider">
                     <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {formatTime(item.arrivalTime)}</span>
                     <span className="text-slate-300">|</span>
                     <span>OPD Ward 4</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl mb-6">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Triage Note</div>
                    <p className="text-xs font-semibold text-slate-700 leading-relaxed line-clamp-2">{item.reason}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-5">
                    <div className="flex -space-x-2">
                      {[1, 2].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400" />
                      ))}
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-emerald-50 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                        +2
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <span className="text-xs font-bold uppercase tracking-wider">Start Encounter</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          </motion.div>
        ))}
        
        <button className="border-2 border-dashed border-slate-200 rounded-[1.5rem] p-6 flex flex-col items-center justify-center text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-all gap-4 bg-white/50 group shadow-sm">
          <div className="w-12 h-12 rounded-2xl border-2 border-current flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
            <AlertCircle className="w-6 h-6" />
          </div>
          <span className="font-bold text-sm uppercase tracking-widest">Register Walk-in</span>
        </button>
      </section>
    </div>
  );
}

