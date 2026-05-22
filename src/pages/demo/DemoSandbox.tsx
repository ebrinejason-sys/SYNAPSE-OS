import { Routes, Route, Link, useLocation } from 'react-router-dom';
import DemoLandingPage from './DemoLandingPage';
import DoctorQueue from '../os/DoctorQueue';
import EncounterScreen from '../os/EncounterScreen';
import { Activity, LayoutDashboard, Beaker, Shield, Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';

const SidebarLink = ({ to, icon: Icon, label, active }: { to: string; icon: any; label: string; active: boolean }) => (
  <Link
    to={to}
    className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
      active
        ? 'bg-gold text-ink shadow-lg shadow-gold/20'
        : 'text-text-3 hover:text-text-1 hover:bg-surface-2'
    )}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </Link>
);

export default function DemoSandbox() {
  const location = useLocation();

  if (location.pathname === '/demo' || location.pathname === '/demo/') {
    return <DemoLandingPage />;
  }

  return (
    <div className="flex h-screen bg-ink text-text-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-edge flex flex-col bg-surface-1 shrink-0">
        <div className="p-6">
          <Link to="/demo" className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-gold rounded-lg flex items-center justify-center shadow-lg shadow-gold/20">
              <Activity className="w-5 h-5 text-ink" />
            </div>
            <span className="font-display font-black text-lg tracking-tight uppercase">
              Synapse<span className="text-gold">OS</span>
            </span>
          </Link>

          <nav className="space-y-1.5">
            <SidebarLink
              to="/demo/doctor"
              icon={LayoutDashboard}
              label="Patient Queue"
              active={location.pathname.startsWith('/demo/doctor') || location.pathname.startsWith('/demo/encounter')}
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
          <div className="bg-gold/5 border border-gold/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 label-xs text-gold mb-2">
              <Terminal className="w-3 h-3" />
              SANDBOX MODE
            </div>
            <p className="text-[10px] text-text-3 font-bold uppercase leading-relaxed tracking-wider">
              Isolated demo environment. All actions are simulated.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-ink relative">
        <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-gold/40 via-gold/10 to-transparent" />
        <Routes>
          <Route path="doctor" element={<DoctorQueue />} />
          <Route path="encounter/:id" element={<EncounterScreen />} />
          <Route path="*" element={<DoctorQueue />} />
        </Routes>
      </main>
    </div>
  );
}
