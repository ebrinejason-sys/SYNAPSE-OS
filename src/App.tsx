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
import TeleChatbot from './pages/tele/TeleChatbot';
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
    { label: 'Lab Orders', path: '/lab/orders' },
    { label: 'Pharmacy', path: '/pharmacy/queue' },
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
        {/* Public Website (synapseos.tech) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<SimplePage />} />
        <Route path="/sdg" element={<SimplePage />} />
        <Route path="/pricing" element={<LandingPage />} />
        <Route path="/demo" element={<SimplePage />} />
        <Route path="/demo/doctor" element={<OSLayout><DoctorQueue /></OSLayout>} />
        <Route path="/about" element={<SimplePage />} />
        <Route path="/blog" element={<SimplePage />} />
        <Route path="/contact" element={<SimplePage />} />
        <Route path="/careers" element={<SimplePage />} />
        <Route path="/press" element={<SimplePage />} />
        <Route path="/changelog" element={<SimplePage />} />
        <Route path="/status" element={<SimplePage />} />
        <Route path="/docs" element={<SimplePage />} />
        <Route path="/apply" element={<PilotApply />} />
        <Route path="/apply-professional" element={<SimplePage />} />

        {/* Legal */}
        <Route path="/legal/privacy" element={<SimplePage />} />
        <Route path="/legal/terms" element={<SimplePage />} />
        <Route path="/legal/dpa" element={<SimplePage />} />
        <Route path="/legal/cookie-policy" element={<SimplePage />} />

        {/* Synapse OS Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Synapse OS Dashboard & Clinical */}
        <Route path="/doctor/queue" element={<OSLayout><DoctorQueue /></OSLayout>} />
        <Route path="/doctor/tele" element={<OSLayout><DoctorTele /></OSLayout>} />
        <Route path="/encounter/:id" element={<OSLayout><EncounterScreen /></OSLayout>} />

        {/* OS Departments */}
        <Route path="/lab/orders" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/pharmacy/queue" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/radiology/orders" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/maternity/anc" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/paediatrics/queue" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/hiv/dashboard" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/ae/triage" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/theatre/schedule" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/icu/dashboard" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/cardiology/ecg" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/mental/assessments" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/oncology/staging" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/dialysis/sessions" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Admin */}
        <Route path="/admin" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/audit" element={<OSLayout><AuditLog /></OSLayout>} />

        {/* Synapse App Routes */}
        <Route path="/app/dashboard" element={<PatientDashboard />} />
        <Route path="/records/labs" element={<SimplePage />} />
        <Route path="/children" element={<SimplePage />} />
        <Route path="/tele" element={<TeleChatbot />} />
        <Route path="/tele/booking" element={<TeleBooking />} />
        <Route path="/tele/booked/:id" element={<TeleBooked />} />
        <Route path="/tele/room/:id" element={<TeleRoom />} />
        <Route path="/medical-id" element={<SimplePage />} />
        <Route path="/emergency" element={<SimplePage />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
