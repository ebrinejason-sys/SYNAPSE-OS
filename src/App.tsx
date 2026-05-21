import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { SynapseLogo } from './components/ui/SynapseLogo';
import LandingPage from './pages/LandingPage';
import DoctorQueue from './pages/os/DoctorQueue';
import EncounterScreen from './pages/os/EncounterScreen';
import PatientDashboard from './pages/app/PatientDashboard';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import PilotApply from './pages/marketing/PilotApply';
import DemoSandbox from './pages/demo/DemoSandbox';
import SimplePage from './pages/marketing/SimplePage';

import AuditLog from './pages/os/AuditLog';

// Layout wrapper for OS components
const OSLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  const navItems = [
    { label: 'Patient Queue', path: '/os/doctor/queue' },
    { label: 'Lab Orders', path: '/docs' }, // DOCS as stub
    { label: 'Pharmacy', path: '/docs' }, // DOCS as stub
    { label: 'Audit Logs', path: '/os/audit' },
  ];

  return (
    <div className="min-h-screen bg-bg-page font-sans text-text-main flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-10">
          <Link to="/" className="group">
            <SynapseLogo variant="light" className="text-slate-900 group-hover:opacity-80 transition-opacity" />
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right mr-2 hidden md:block">
            <p className="text-xs font-bold text-slate-900">Dr. Okello Moses</p>
            <p className="text-[10px] text-slate-500 font-medium">Mengo Hospital • OPD</p>
          </div>
          <div className="w-10 h-10 bg-slate-100 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-slate-400 font-bold text-xs uppercase tracking-tighter group hover:border-emerald-200 transition-colors cursor-pointer">OM</div>
        </div>
      </header>
      
      {/* Secondary Doctor Navigation */}
      <div className="bg-white border-b border-slate-100 px-6 flex items-center gap-8 sticky top-16 z-40 shrink-0">
        <div className="flex items-center gap-4 py-2 bg-emerald-50/50 px-3 rounded-lg border border-emerald-100/50 my-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Encounter Active</span>
        </div>
        <nav className="flex items-center gap-8 h-12">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  "text-xs font-bold uppercase tracking-widest transition-all relative h-full flex items-center px-1",
                  isActive 
                    ? "text-emerald-600 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-emerald-600" 
                    : "text-slate-400 hover:text-slate-900"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            key={location.pathname}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Marketing */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/apply" element={<PilotApply />} />
        
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Demo / Sandbox (YC Requirement) */}
        <Route path="/demo/*" element={<DemoSandbox />} />

        {/* OS Routes */}
        <Route path="/os/doctor/queue" element={<OSLayout><DoctorQueue /></OSLayout>} />
        <Route path="/os/doctor/encounter/:id" element={<OSLayout><EncounterScreen /></OSLayout>} />
        <Route path="/os/audit" element={<OSLayout><AuditLog /></OSLayout>} />

        {/* App Routes (Patient) */}
        <Route path="/app/dashboard" element={<PatientDashboard />} />

        {/* Stubs & Legal */}
        <Route path="/about" element={<SimplePage />} />
        <Route path="/features" element={<SimplePage />} />
        <Route path="/pricing" element={<SimplePage />} />
        <Route path="/blog" element={<SimplePage />} />
        <Route path="/contact" element={<SimplePage />} />
        <Route path="/careers" element={<SimplePage />} />
        <Route path="/docs" element={<SimplePage />} />
        <Route path="/status" element={<SimplePage />} />
        <Route path="/changelog" element={<SimplePage />} />
        <Route path="/privacy" element={<SimplePage />} />
        <Route path="/terms" element={<SimplePage />} />
        <Route path="/dpa" element={<SimplePage />} />
        <Route path="/consent" element={<SimplePage />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

