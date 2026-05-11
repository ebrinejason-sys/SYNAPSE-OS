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
import SimplePage from './pages/marketing/SimplePage';
import TeleChatbot from './pages/tele/TeleChatbot';
import DemoLandingPage from './pages/demo/DemoLandingPage';
import TeleBooking from './pages/tele/TeleBooking';
import TeleBooked from './pages/tele/TeleBooked';
import TeleRoom from './pages/tele/TeleRoom';
import DoctorTele from './pages/os/DoctorTele';
import { ThemeToggle } from './components/ThemeToggle';
import { Logo } from './components/Logo';
import AuditLog from './pages/os/AuditLog';

// Layout wrapper for OS components
const OSLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  const navItems = [
    { label: 'Patient Queue', path: '/doctor/queue' },
    { label: 'Telemedicine', path: '/doctor/tele' },
    { label: 'Audit Logs', path: '/admin/audit' },
  ];

  return (
    <div className="min-h-screen bg-synapse-black font-sans text-[var(--text-primary)] flex flex-col selection:bg-synapse-primary/30 selection:text-cyan-200">
      <header className="h-16 bg-synapse-black/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2 group">
            <Logo size="sm" />
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right mr-2 hidden md:block">
            <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">Dr. Okello Moses</p>
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Mengo Hospital • OPD</p>
          </div>
          <ThemeToggle />
          <div className="w-10 h-10 bg-white/5 rounded-full border border-white/10 flex items-center justify-center text-synapse-primary font-black text-xs uppercase tracking-tighter group hover:border-synapse-primary/50 transition-colors cursor-pointer">OM</div>
        </div>
      </header>
      
      {/* Secondary Navigation */}
      <div className="bg-synapse-dark border-b border-white/5 px-6 flex items-center gap-8 sticky top-16 z-40 shrink-0">
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
                    ? "text-synapse-primary after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-synapse-primary"
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
        {/* Public Website */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<SimplePage />} />
        <Route path="/about" element={<SimplePage />} />
        <Route path="/contact" element={<SimplePage />} />
        <Route path="/apply" element={<PilotApply />} />
        <Route path="/demo" element={<DemoLandingPage />} />

        {/* Telemedicine Flow (Public) */}
        <Route path="/telemedicine" element={<Navigate to="/tele" replace />} />
        <Route path="/tele" element={<TeleChatbot />} />
        <Route path="/tele/booking" element={<TeleBooking />} />
        <Route path="/tele/booked/:id" element={<TeleBooked />} />
        <Route path="/tele/room/:id" element={<TeleRoom />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* OS Dashboard */}
        <Route path="/doctor/queue" element={<OSLayout><DoctorQueue /></OSLayout>} />
        <Route path="/doctor/tele" element={<OSLayout><DoctorTele /></OSLayout>} />
        <Route path="/encounter/:id" element={<OSLayout><EncounterScreen /></OSLayout>} />
        <Route path="/admin/audit" element={<OSLayout><AuditLog /></OSLayout>} />

        {/* App Dashboard */}
        <Route path="/app/dashboard" element={<PatientDashboard />} />

        {/* Legal */}
        <Route path="/legal/:slug" element={<SimplePage />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
