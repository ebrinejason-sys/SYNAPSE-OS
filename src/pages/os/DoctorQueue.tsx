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
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Patient Queue</h1>
            <p className="text-neutral-600 text-sm font-medium mt-2">
              Monitoring {filteredQueue.length} active outpatient encounters
              {isLoading && ' (loading...)'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search MRN or name..." 
                className="input pl-10 w-full sm:w-64"
              />
            </div>
            <button className="p-2.5 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors">
              <Filter className="w-4 h-4 text-neutral-600" />
            </button>
          </div>
        </header>

        {/* Priority Filter Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {['all', 'red', 'yellow', 'green'].map(priority => (
            <button
              key={priority}
              onClick={() => setPriorityFilter(priority as any)}
              className={cn(
                "px-4 py-2 rounded-lg font-medium text-sm transition-all",
                priorityFilter === priority
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-neutral-700 border border-neutral-300 hover:border-neutral-400'
              )}
            >
              {priority === 'all' ? 'All' : priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
            </button>
          ))}
        </div>

        {/* Queue Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-8 h-8 text-green-600 animate-spin" />
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-600 font-medium">No patients found</p>
          </div>
        ) : (
          <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQueue.map((item: any, i: number) => {
              const acuity = acuityMap[item.acuity_level || item.acuity] || 'GREEN';
              const acuityColor = 
                acuity === 'RED' ? { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-700', badge: 'bg-red-50' } :
                acuity === 'YELLOW' ? { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-700', badge: 'bg-amber-50' } :
                { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-700', badge: 'bg-green-50' };

              const patientName = item.patient ? `${item.patient.first_name} ${item.patient.last_name}` : item.patientName;
              const patientId = item.patient?.id || item.patientId;
              const encounterId = item.id;
              const mrn = item.patient?.mrn || item.id;
              const chiefComplaint = item.chief_complaint || item.visit_reason || item.reason;

              return (
                <motion.div
                  key={encounterId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="group"
                >
                  <Link to={`/demo/encounter/${encounterId}`}>
                    <article className="bg-white p-6 rounded-xl border-2 border-neutral-200 hover:border-green-500 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden shadow-sm">
                      {/* Acuity Bar */}
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${acuityColor.bg}`} />
                      
                      {/* Header */}
                      <div className="flex justify-between items-start mb-5 pl-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            acuityColor.badge,
                            acuityColor.text
                          )}>
                            {acuity} Priority
                          </span>
                          <span className="text-neutral-300">·</span>
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{mrn}</span>
                        </div>
                        <button className="p-1 hover:bg-neutral-100 rounded text-neutral-400">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Patient Info */}
                      <div className="pl-2">
                        <h3 className="text-lg font-bold mb-1 text-neutral-900 group-hover:text-green-700 transition-colors">{patientName}</h3>
                        <div className="flex items-center gap-4 text-[11px] font-semibold text-neutral-500 mb-6 uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-neutral-400" /> 
                            {new Date(item.created_at || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-neutral-300">|</span>
                          <span>OPD Ward</span>
                        </div>

                        {/* Chief Complaint */}
                        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-lg mb-6">
                          <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Chief Complaint</div>
                          <p className="text-xs font-medium text-neutral-700 leading-relaxed line-clamp-2">{chiefComplaint}</p>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                          <div className="flex -space-x-2">
                            {[1, 2].map(j => (
                              <div key={j} className="w-7 h-7 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-[9px] font-bold text-neutral-400" />
                            ))}
                            <div className="w-7 h-7 rounded-full border-2 border-white bg-green-50 flex items-center justify-center text-[9px] font-bold text-green-700">
                              +1
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-green-600 font-bold">
                            <span className="text-xs uppercase tracking-wider">Start</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                </motion.div>
              );
            })}

            {/* Add Patient Button */}
            <button className="border-2 border-dashed border-neutral-300 rounded-xl p-8 flex flex-col items-center justify-center text-neutral-400 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all gap-4 bg-white/50 group shadow-sm">
              <div className="w-12 h-12 rounded-lg border-2 border-current flex items-center justify-center group-hover:bg-green-100 transition-colors">
                <AlertCircle className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm uppercase tracking-wider">Register Walk-in</span>
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

