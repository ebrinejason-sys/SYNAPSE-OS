import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import DemoLandingPage from './DemoLandingPage';
import DoctorQueue from '../os/DoctorQueue';
import EncounterScreen from '../os/EncounterScreen';
import { Activity, LayoutDashboard, Beaker, Shield, Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';

const SidebarLink = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl text-mono-xs transition-all",
      active
        ? "bg-synapse-primary text-synapse-black font-black shadow-lg shadow-cyan-500/20"
        : "text-neutral-500 hover:text-white hover:bg-white/5"
    )}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </Link>
);

export default function DemoSandbox() {
  const location = useLocation();

  // If we are on the landing page, don't show the dashboard layout
  if (location.pathname === '/demo' || location.pathname === '/demo/') {
    return <DemoLandingPage />;
  }

  return (
    <div className="flex h-screen bg-synapse-black text-white overflow-hidden selection:bg-synapse-primary/30 selection:text-cyan-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col bg-synapse-black shrink-0">
        <div className="p-6">
          <Link to="/demo" className="flex items-center gap-2 group mb-10">
            <div className="w-8 h-8 bg-synapse-primary rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5 text-synapse-black" />
            </div>
            <span className="font-black text-lg tracking-tighter text-white uppercase">
              Synapse<span className="text-synapse-primary font-black">OS</span>
            </span>
          </Link>

          <nav className="space-y-2">
            <SidebarLink
              to="/demo/doctor"
              icon={LayoutDashboard}
              label="Patient Queue"
              active={location.pathname === '/demo/doctor'}
            />
            <SidebarLink
              to="/demo/lab"
              icon={Beaker}
              label="Lab Orders"
              active={location.pathname === '/demo/lab'}
            />
            <SidebarLink
              to="/demo/security"
              icon={Shield}
              label="Audit Logs"
              active={location.pathname === '/demo/security'}
            />
          </nav>
        </div>

        <div className="mt-auto p-6">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-mono-xs text-synapse-primary mb-2">
              <Terminal className="w-3 h-3" />
              SANDBOX MODE
            </div>
            <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed tracking-wider">
              Isolated demo environment. All actions are simulated.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-synapse-black relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-synapse-primary to-transparent opacity-20" />
        <Routes>
          <Route path="doctor" element={<DoctorQueue />} />
          <Route path="encounter/:id" element={<EncounterScreen />} />
          <Route path="*" element={<DoctorQueue />} />
        </Routes>
      </main>
    </div>
  );
}
