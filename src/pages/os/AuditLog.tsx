import React from 'react';
import { motion } from 'motion/react';
import { Shield, Clock, User, FileText, Search } from 'lucide-react';

export default function AuditLog() {
  const logs = [
    { id: '1', action: 'Encounter Record Accessed', user: 'Dr. Okello Moses', type: 'clinical', timestamp: '2 mins ago', patient: 'Kato John' },
    { id: '2', action: 'AI Diagnosis Triggered', user: 'Dr. Okello Moses', type: 'clinical', timestamp: '5 mins ago', patient: 'Kato John' },
    { id: '3', action: 'Drug Interaction Check', user: 'Pharm. Namono Sarah', type: 'security', timestamp: '12 mins ago', patient: 'Mukasa Paul' },
    { id: '4', action: 'System Login', user: 'Admin Sarah', type: 'system', timestamp: '45 mins ago', patient: 'N/A' },
  ];

  return (
    <div className="min-h-screen bg-synapse-black p-8 text-white selection:bg-synapse-primary/30 selection:text-cyan-200">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-synapse-primary" />
              <h1 className="text-3xl font-black uppercase tracking-tight">Audit Trail</h1>
            </div>
            <p className="text-mono-xs text-neutral-600">HIPAA Compliant Immutable Access Logs</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            <input type="text" className="input pl-12 w-full md:w-80" placeholder="Search logs..." />
          </div>
        </header>

        <div className="card overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="px-6 py-4 text-mono-xs text-neutral-500">Timestamp</th>
                  <th className="px-6 py-4 text-mono-xs text-neutral-500">Action / Event</th>
                  <th className="px-6 py-4 text-mono-xs text-neutral-500">User Agent</th>
                  <th className="px-6 py-4 text-mono-xs text-neutral-500">Context</th>
                  <th className="px-6 py-4 text-mono-xs text-neutral-500 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log, i) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-white/5 transition-colors group"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-neutral-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold font-mono">{log.timestamp}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-synapse-primary" />
                        <span className="text-sm font-black uppercase tracking-tight text-white">{log.action}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-neutral-400">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase tracking-wider">{log.user}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs text-neutral-600 font-bold uppercase tracking-widest">
                      {log.patient !== 'N/A' && `Patient: ${log.patient}`}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="badge-primary">VERIFIED</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
