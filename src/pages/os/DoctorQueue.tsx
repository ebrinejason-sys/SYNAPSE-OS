import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Filter, MoreVertical, Clock, AlertCircle, ArrowRight, Loader } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { useDemoPatientQueue, useDemoFacilities } from '../../hooks/useDemoData';
import { DEMO_QUEUE } from '../../constants';

export default function DoctorQueue() {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'red' | 'yellow' | 'green'>('all');
  
  // Try to fetch from Supabase, fallback to constants
  const { facilities, loading: facilitiesLoading } = useDemoFacilities();
  const facilityId = facilities?.[0]?.id;
  const { patients, loading: patientsLoading } = useDemoPatientQueue(facilityId || '');

  // Use real data if available, otherwise use demo constants
  const queueData = patients.length > 0 ? patients : DEMO_QUEUE;
  const isLoading = (facilityId && patientsLoading) || facilitiesLoading;

  // Map acuity levels for compatibility
  const acuityMap: any = {
    'Red': 'RED',
    'Yellow': 'YELLOW',
    'Green': 'GREEN',
    'RED': 'RED',
    'YELLOW': 'YELLOW',
    'GREEN': 'GREEN',
  };

  // Filter queue data
  const filteredQueue = queueData.filter(item => {
    const acuity = acuityMap[item.acuity_level || item.acuity] || 'GREEN';
    const matchesPriority = priorityFilter === 'all' || acuity.toLowerCase() === priorityFilter;
    const matchesSearch = searchTerm === '' || 
      (item.patient?.first_name || item.patientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.patient?.last_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.mrn || item.id || '').includes(searchTerm);
    return matchesPriority && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-synapse-black p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase">Patient Queue</h1>
            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">
              Monitoring {filteredQueue.length} active outpatient encounters
              {isLoading && ' (loading...)'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-4 h-4" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search MRN or name..." 
                className="input pl-10 w-full sm:w-64"
              />
            </div>
            <button className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
              <Filter className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        </header>

        {/* Priority Filter Tabs */}
        <div className="flex gap-2 mb-10 flex-wrap">
          {['all', 'red', 'yellow', 'green'].map(priority => (
            <button
              key={priority}
              onClick={() => setPriorityFilter(priority as any)}
              className={cn(
                "px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border",
                priorityFilter === priority
                  ? 'bg-synapse-primary text-synapse-black border-synapse-primary shadow-lg shadow-cyan-500/20'
                  : 'bg-white/5 text-neutral-500 border-white/10 hover:border-white/20'
              )}
            >
              {priority === 'all' ? 'All' : priority} Priority
            </button>
          ))}
        </div>

        {/* Queue Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-8 h-8 text-synapse-primary animate-spin" />
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <AlertCircle className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
            <p className="text-neutral-500 font-bold uppercase text-[10px] tracking-widest">No patients found</p>
          </div>
        ) : (
          <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQueue.map((item: any, i: number) => {
              const acuity = acuityMap[item.acuity_level || item.acuity] || 'GREEN';
              const acuityConfig =
                acuity === 'RED' ? { color: 'text-red-500', bg: 'bg-red-500', glow: 'shadow-red-500/20' } :
                acuity === 'YELLOW' ? { color: 'text-amber-500', bg: 'bg-amber-500', glow: 'shadow-amber-500/20' } :
                { color: 'text-emerald-500', bg: 'bg-emerald-500', glow: 'shadow-emerald-500/20' };

              const patientName = item.patient ? `${item.patient.first_name} ${item.patient.last_name}` : item.patientName;
              const encounterId = item.id;
              const mrn = item.patient?.mrn || item.id;
              const chiefComplaint = item.chief_complaint || item.visit_reason || item.reason;

              return (
                <motion.div
                  key={encounterId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group"
                >
                  <Link to={`/encounter/${encounterId}`}>
                    <article className="card-interactive p-6 relative overflow-hidden group">
                      {/* Acuity Dot */}
                      <div className={cn(
                        "absolute top-6 right-6 w-2 h-2 rounded-full animate-pulse",
                        acuityConfig.bg
                      )} />
                      
                      {/* Header */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn(
                            "text-mono-xs",
                            acuityConfig.color
                          )}>
                            {acuity} Priority
                          </span>
                          <span className="text-white/10">·</span>
                          <span className="text-mono-xs text-neutral-600 uppercase tracking-widest">{mrn}</span>
                        </div>
                        <h3 className="text-xl font-black text-white group-hover:text-synapse-primary transition-colors leading-tight uppercase tracking-tight">
                          {patientName}
                        </h3>
                      </div>

                      {/* Info Row */}
                      <div className="flex items-center gap-4 text-mono-xs text-neutral-500 mb-6 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {new Date(item.created_at || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="w-1 h-1 bg-white/10 rounded-full" />
                        <span>OPD WARD</span>
                      </div>

                      {/* Complaint */}
                      <div className="bg-white/5 border border-white/5 p-4 rounded-xl mb-6">
                        <p className="text-[11px] font-medium text-neutral-400 leading-relaxed line-clamp-2 uppercase">
                          {chiefComplaint}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex -space-x-2">
                          {[1, 2].map(j => (
                            <div key={j} className="w-7 h-7 rounded-full border border-synapse-black bg-neutral-800 flex items-center justify-center text-mono-xs text-neutral-500" />
                          ))}
                          <div className="w-7 h-7 rounded-full border border-synapse-black bg-synapse-primary/10 flex items-center justify-center text-mono-xs text-synapse-primary">
                            +1
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-synapse-primary font-black uppercase text-[10px] tracking-widest group-hover:translate-x-1 transition-transform">
                          Open <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    </article>
                  </Link>
                </motion.div>
              );
            })}

            {/* Add Patient Button */}
            <button className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-neutral-600 hover:border-synapse-primary/50 hover:text-synapse-primary hover:bg-synapse-primary/5 transition-all gap-4 bg-white/5 group shadow-sm">
              <div className="w-12 h-12 rounded-xl border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertCircle className="w-6 h-6" />
              </div>
              <span className="text-mono-xs uppercase tracking-widest font-black">Register Walk-in</span>
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
