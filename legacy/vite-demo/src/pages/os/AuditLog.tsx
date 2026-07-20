import { motion } from 'motion/react';
import { Shield, Clock, User, Search } from 'lucide-react';

export default function AuditLog() {
  const logs = [
    { id: '1', action: 'Encounter Record Accessed', user: 'Dr. Okello Moses', type: 'clinical', timestamp: '2 mins ago', patient: 'Kato John' },
    { id: '2', action: 'AI Diagnosis Triggered', user: 'Dr. Okello Moses', type: 'clinical', timestamp: '5 mins ago', patient: 'Kato John' },
    { id: '3', action: 'Drug Interaction Check', user: 'Pharm. Namono Sarah', type: 'security', timestamp: '12 mins ago', patient: 'Mukasa Paul' },
    { id: '4', action: 'System Login', user: 'Admin Sarah', type: 'system', timestamp: '45 mins ago', patient: 'N/A' },
  ];

  return (
    <div className="min-h-screen bg-ink p-8 text-text-1">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-gold" />
              <h1 className="font-display text-3xl font-black uppercase tracking-tight">Audit Trail</h1>
            </div>
            <p className="label-xs">HIPAA Compliant Immutable Access Logs</p>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
            <input type="text" className="input pl-12 w-full md:w-80" placeholder="Search logs..." />
          </div>
        </header>

        <div className="rounded-2xl border border-edge overflow-hidden bg-surface-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-edge">
                  <th className="px-6 py-4 label-xs">Timestamp</th>
                  <th className="px-6 py-4 label-xs">Action / Event</th>
                  <th className="px-6 py-4 label-xs">User Agent</th>
                  <th className="px-6 py-4 label-xs">Context</th>
                  <th className="px-6 py-4 label-xs text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {logs.map((log, i) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-surface-2 transition-colors"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-text-3">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold font-mono">{log.timestamp}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-gold" />
                        <span className="text-sm font-black uppercase tracking-tight text-text-1">{log.action}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-text-2">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase tracking-wider">{log.user}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs text-text-3 font-bold uppercase tracking-widest">
                      {log.patient !== 'N/A' && `Patient: ${log.patient}`}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="badge-gold">VERIFIED</span>
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
