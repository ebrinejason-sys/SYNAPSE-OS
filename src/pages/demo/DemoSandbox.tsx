import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Play, Shield, Globe, Lock, ArrowRight, Activity, Beaker, Zap } from 'lucide-react';
import DoctorQueue from '../os/DoctorQueue';
import EncounterScreen from '../os/EncounterScreen';

export default function DemoSandbox() {
  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <Routes>
        <Route index element={<DemoHome />} />
        <Route path="doctor" element={<DemoLayout title="Synapse OS · Clinical Sandbox"><DoctorQueue /></DemoLayout>} />
        <Route path="encounter/:id" element={<DemoLayout title="Synapse OS · Patient Encounter"><EncounterScreen /></DemoLayout>} />
        <Route path="*" element={<Navigate to="/demo" replace />} />
      </Routes>
    </div>
  );
}

function DemoLayout({ children, title }: { children: React.ReactNode, title: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="h-14 bg-[#0F172A] text-white px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link to="/demo" className="hover:text-green-400 transition-all font-bold text-sm flex items-center gap-2">
            <Globe className="w-4 h-4" /> Exit Sandbox
          </Link>
          <div className="h-4 w-px bg-white/20" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse">
            Sandbox Active
          </div>
        </div>
      </nav>
      <main className="p-8 flex-1">
        {children}
      </main>
    </div>
  );
}

function DemoHome() {
  return (
    <div className="pt-20 pb-32 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 bg-green-600 rounded-[2rem] flex items-center justify-center text-white mx-auto shadow-2xl shadow-green-500/20 mb-8"
          >
            <Shield className="w-10 h-10" />
          </motion.div>
          <h1 className="text-5xl font-bold text-[#0F172A] mb-6 tracking-tight">Interactive Sandbox v2.0</h1>
          <p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
            Explore the Synapse Ecosystem without creating an account. All data is pre-seeded and resets daily.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Link to="/demo/doctor">
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-xl shadow-gray-200/50 group"
            >
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 mb-8 group-hover:bg-green-600 group-hover:text-white transition-all">
                <Activity className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-4">Synapse OS: Clinical</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Experience the patient queue, AI diagnosis engine, and grounded clinical guideline integration.
              </p>
              <div className="flex items-center gap-2 text-green-600 font-bold uppercase tracking-widest text-xs">
                Launch Dashboard <ArrowRight className="w-4 h-4" />
              </div>
            </motion.div>
          </Link>

          <motion.div
            whileHover={{ y: -5 }}
            className="bg-white p-10 rounded-[3rem] border border-gray-200 opacity-60 relative overflow-hidden group cursor-not-allowed"
          >
             <div className="absolute top-6 right-6 px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase tracking-widest">In Development</div>
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 mb-8">
                <Beaker className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-4">Synapse OS: Pharmacy</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                FEFO-based dispensing, integrated insurance copilot, and multi-tenant stock management.
              </p>
          </motion.div>
        </div>

        <div className="bg-[#0F172A] rounded-[3rem] p-12 text-white overflow-hidden relative">
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
            <div className="md:w-1/2">
              <div className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase tracking-[0.3em] mb-6">
                 <Zap className="w-4 h-4" /> Next-Gen Integration
              </div>
              <h2 className="text-3xl font-bold mb-6">Connected Care Bridge</h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Every action in the OS syncs in real-time with the Synapse App. Experience how visit summaries and prescriptions reach patients instantly.
              </p>
              <Link to="/signup" className="inline-flex items-center gap-3 bg-green-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-green-700 transition-all">
                Create Professional Account <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="md:w-1/2 grid grid-cols-2 gap-4">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="h-32 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center">
                    <div className="w-12 h-2 bg-white/20 rounded" />
                 </div>
               ))}
            </div>
          </div>
          {/* Background Glow */}
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-green-500/20 rounded-full blur-[120px]" />
        </div>
      </div>
    </div>
  );
}
