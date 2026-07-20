import { motion } from 'motion/react';
import {
  Building2, Users, Activity, TrendingUp, Shield,
  Globe, Cpu, Database, AlertTriangle, CheckCircle2,
  ArrowRight, BarChart3, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

const hospitals = [
  { name: 'Mulago National Referral', slug: 'mulago', status: 'active', patients: 1842, encounters: 234, tier: 'Tier 4' },
  { name: 'Mengo Hospital', slug: 'mengo', status: 'active', patients: 643, encounters: 87, tier: 'Tier 3' },
  { name: 'Kiruddu Referral', slug: 'kiruddu', status: 'active', patients: 512, encounters: 61, tier: 'Tier 3' },
  { name: 'Kawempe General', slug: 'kawempe', status: 'pending', patients: 0, encounters: 0, tier: 'Tier 2' },
];

const systemStats = [
  { label: 'Total Hospitals', value: '3', delta: '+1 this month', icon: Building2, color: 'text-gold' },
  { label: 'Active Patients', value: '2,997', delta: '+18% MoM', icon: Users, color: 'text-emerald' },
  { label: 'AI Diagnoses', value: '1,204', delta: 'This month', icon: Cpu, color: 'text-blue' },
  { label: 'Avg Response', value: '1.2s', delta: 'AI latency', icon: Zap, color: 'text-amber' },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-ink text-text-1">
      {/* Top bar */}
      <header className="bg-surface-1 border-b border-edge px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-gold rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-ink" />
              </div>
              <span className="font-display font-black text-xl tracking-tight uppercase">
                Synapse<span className="text-gold">OS</span> Admin
              </span>
            </div>
            <p className="label-xs">Sovereign Operations Dashboard · All Hospitals</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald/10 border border-emerald/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
              <span className="text-[10px] font-bold text-emerald uppercase tracking-widest">All Systems Operational</span>
            </div>
            <Link to="/" className="btn-outline py-2 px-4 text-[10px]">
              Back to Site
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-10 space-y-12">
        {/* System stats */}
        <section>
          <h2 className="label-sm mb-5">Platform Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {systemStats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="card p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <p className="label-xs">{stat.label}</p>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className={`font-display text-3xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-text-3 font-bold mt-1">{stat.delta}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Hospitals */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="label-sm">Onboarded Hospitals</h2>
            <button type="button" className="btn-outline py-2 px-4 text-[10px] flex items-center gap-2">
              <Building2 className="w-3 h-3" /> Onboard New Hospital
            </button>
          </div>

          <div className="space-y-3">
            {hospitals.map((h, i) => (
              <motion.div
                key={h.slug}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-5 flex items-center justify-between gap-6"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-black text-sm shrink-0">
                    {h.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-display font-bold text-text-1">{h.name}</span>
                      <span className="text-[9px] font-bold text-text-3 bg-surface-3 border border-edge px-2 py-0.5 rounded uppercase tracking-widest">{h.tier}</span>
                    </div>
                    <div className="flex items-center gap-4 label-xs">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {h.slug}.synapseos.tech
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  {h.status === 'active' ? (
                    <>
                      <div className="text-center hidden sm:block">
                        <p className="font-display font-black text-xl text-text-1">{h.patients.toLocaleString()}</p>
                        <p className="label-xs">Patients</p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <p className="font-display font-black text-xl text-gold">{h.encounters}</p>
                        <p className="label-xs">Today</p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald/10 border border-emerald/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald" />
                        <span className="text-[10px] font-bold text-emerald uppercase tracking-widest">Active</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest">Pending Setup</span>
                    </div>
                  )}

                  <button type="button" className="flex items-center gap-1.5 text-xs font-bold text-text-3 hover:text-gold transition-colors uppercase tracking-widest whitespace-nowrap">
                    Manage <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Infrastructure */}
        <section className="grid md:grid-cols-3 gap-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-gold" />
              <h3 className="label-sm">Supabase</h3>
            </div>
            <div className="space-y-2 text-xs">
              {[
                { label: 'DB Size', value: '2.4 GB' },
                { label: 'Active Connections', value: '12' },
                { label: 'RLS Policies', value: '34 active' },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-text-2">
                  <span className="text-text-3">{r.label}</span>
                  <span className="font-mono font-bold">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gold" />
              <h3 className="label-sm">LiveKit</h3>
            </div>
            <div className="space-y-2 text-xs">
              {[
                { label: 'Active Rooms', value: '2' },
                { label: 'UG Cluster Latency', value: '12ms' },
                { label: 'Calls This Month', value: '87' },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-text-2">
                  <span className="text-text-3">{r.label}</span>
                  <span className="font-mono font-bold">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gold" />
              <h3 className="label-sm">AI Usage</h3>
            </div>
            <div className="space-y-2 text-xs">
              {[
                { label: 'Diagnoses Run', value: '1,204' },
                { label: 'UCG Lookups', value: '3,891' },
                { label: 'Avg Confidence', value: '78%' },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-text-2">
                  <span className="text-text-3">{r.label}</span>
                  <span className="font-mono font-bold">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
