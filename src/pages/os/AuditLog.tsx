import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, User, Clock, Search, Filter, History, AlertCircle, FileText, Settings, Database } from 'lucide-react';
import { getAuditLogs } from '../../services/auditService';
import { formatTime, formatDate } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { AuditLogEntry } from '../../types';

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    setLogs(getAuditLogs());
  }, []);
  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'clinical': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'security': return 'bg-red-50 text-red-700 border-red-100';
      case 'administrative': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'inventory': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'clinical': return <FileText className="w-3.5 h-3.5" />;
      case 'security': return <Shield className="w-3.5 h-3.5" />;
      case 'administrative': return <Settings className="w-3.5 h-3.5" />;
      case 'inventory': return <Database className="w-3.5 h-3.5" />;
      default: return <History className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <Shield className="w-5 h-5 text-emerald-600" />
             <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Audit Logs</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">Immutable record of all clinical and administrative actions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Filter by user or action..." 
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-72 shadow-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <Filter className="w-4 h-4" /> EXPORT PDF
          </button>
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-[1.5rem] overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timestamp</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User / Identity</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event Category</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action Performed</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.map((log, i) => (
              <motion.tr 
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors group"
              >
                <td className="px-6 py-5">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">{formatTime(log.timestamp)}</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase">{formatDate(log.timestamp)}</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                       {log.userName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{log.userName}</span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono uppercase tracking-tighter">ID: {log.userId}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider",
                    getCategoryStyles(log.category)
                  )}>
                    {getCategoryIcon(log.category)}
                    {log.category}
                  </div>
                </td>
                <td className="px-6 py-5">
                   <div className="flex flex-col">
                     <span className="text-sm font-bold text-slate-800">{log.action}</span>
                     <span className="text-xs text-slate-500 mt-0.5 line-clamp-1 italic">{log.metadata?.description}</span>
                   </div>
                </td>
                <td className="px-6 py-5 text-right">
                  <button className="p-2 hover:bg-white border-transparent hover:border-slate-200 border rounded-lg transition-all text-slate-400 hover:text-emerald-600">
                    <AlertCircle className="w-4 h-4" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Tamper-Proof Storage Active</span>
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Signed with RSA-4096</span>
           </div>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Showing last 25 system events</p>
        </div>
      </div>
    </div>
  );
}
