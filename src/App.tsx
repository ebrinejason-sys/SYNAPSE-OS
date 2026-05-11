import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import LandingPage from './pages/LandingPage';
import DoctorQueue from './pages/os/DoctorQueue';
import EncounterScreen from './pages/os/EncounterScreen';
import PatientDashboard from './pages/app/PatientDashboard';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import PilotApply from './pages/marketing/PilotApply';
import DemoSandbox from './pages/demo/DemoSandbox';
import SimplePage from './pages/marketing/SimplePage';
import { Activity } from 'lucide-react';

import AuditLog from './pages/os/AuditLog';

// Telemedicine Pages
import TelemedicinePage from './pages/tele/TelemedicinePage';
import BookingPage from './pages/tele/BookingPage';
import BookingConfirmedPage from './pages/tele/BookingConfirmedPage';
import VideoRoomPage from './pages/tele/VideoRoomPage';
import DoctorTeleDashboard from './pages/os/DoctorTeleDashboard';

// Layout wrapper for OS components
const OSLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  const navItems = [
    { label: 'Patient Queue', path: '/os/doctor/queue' },
    { label: 'Telemedicine', path: '/os/doctor/tele' },
    { label: 'Lab Orders', path: '/docs' },
    { label: 'Pharmacy', path: '/docs' },
    { label: 'Audit Logs', path: '/os/audit' },
  ];

  return (
    <div className="min-h-screen bg-synapse-black font-sans text-white flex flex-col selection:bg-synapse-primary/30 selection:text-cyan-200">
      <header className="h-16 bg-synapse-black/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-synapse-primary rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5 text-synapse-black" />
            </div>
            <span className="font-black text-xl tracking-tighter text-white uppercase">Synapse<span className="text-synapse-primary">OS</span></span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right mr-2 hidden md:block">
            <p className="text-[10px] font-black text-white uppercase tracking-widest">Dr. Okello Moses</p>
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Mengo Hospital • OPD</p>
          </div>
          <div className="w-10 h-10 bg-white/5 rounded-full border border-white/10 flex items-center justify-center text-synapse-primary font-black text-xs uppercase tracking-tighter group hover:border-synapse-primary/50 transition-colors cursor-pointer">OM</div>
        </div>
      </header>
      
      {/* Secondary Doctor Navigation */}
      <div className="bg-synapse-dark border-b border-white/5 px-6 flex items-center gap-8 sticky top-16 z-40 shrink-0">
        <div className="flex items-center gap-4 py-1.5 bg-synapse-primary/10 px-3 rounded-lg border border-synapse-primary/20 my-2">
           <div className="w-1.5 h-1.5 rounded-full bg-synapse-primary animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
           <span className="text-[9px] font-black text-synapse-primary uppercase tracking-[0.2em]">Encounter Active</span>
        </div>
        <nav className="flex items-center gap-8 h-12">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative h-full flex items-center px-1",
                  isActive 
                    ? "text-synapse-primary after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-synapse-primary shadow-[0_4px_12px_rgba(6,182,212,0.1)]"
                    : "text-neutral-500 hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 bg-synapse-black">
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

        {/* Telemedicine (Public) */}
        <Route path="/tele" element={<TelemedicinePage />} />
        <Route path="/tele/booking" element={<BookingPage />} />
        <Route path="/tele/booked/:id" element={<BookingConfirmedPage />} />
        <Route path="/tele/room/:id" element={<VideoRoomPage />} />

        {/* Demo / Sandbox (YC Requirement) */}
        <Route path="/demo/*" element={<DemoSandbox />} />

        {/* OS Routes */}
        <Route path="/os/doctor/queue" element={<OSLayout><DoctorQueue /></OSLayout>} />
        <Route path="/os/doctor/tele" element={<OSLayout><DoctorTeleDashboard /></OSLayout>} />
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
