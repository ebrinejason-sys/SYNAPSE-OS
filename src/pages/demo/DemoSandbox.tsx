import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Globe } from 'lucide-react';
import DemoLandingPage from './DemoLandingPage';
import DoctorQueue from '../os/DoctorQueue';
import EncounterScreen from '../os/EncounterScreen';

export default function DemoSandbox() {
  return (
    <Routes>
      <Route index element={<DemoLandingPage />} />
      <Route path="doctor" element={<DemoLayout title="Synapse OS · Clinical Sandbox"><DoctorQueue /></DemoLayout>} />
      <Route path="encounter/:id" element={<DemoLayout title="Synapse OS · Patient Encounter"><EncounterScreen /></DemoLayout>} />
      <Route path="*" element={<Navigate to="/demo" replace />} />
    </Routes>
  );
}

function DemoLayout({ children, title }: { children: React.ReactNode, title: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <nav className="h-16 bg-neutral-900 text-white px-6 flex items-center justify-between sticky top-0 z-50 border-b border-neutral-800">
        <div className="flex items-center gap-4">
          <Link to="/demo" className="hover:text-green-400 transition-all font-bold text-sm flex items-center gap-2 group">
            <Globe className="w-4 h-4 group-hover:scale-110 transition-transform" /> Exit Sandbox
          </Link>
          <div className="h-4 w-px bg-white/20" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse">
            Sandbox Active
          </div>
        </div>
      </nav>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
