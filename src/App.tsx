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

// Layout wrapper for OS components
const OSLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  const navItems = [
    { label: 'Patient Queue', path: '/doctor/queue' },
    { label: 'Lab Orders', path: '/lab/orders' },
    { label: 'Pharmacy', path: '/pharmacy/queue' },
    { label: 'Audit Logs', path: '/admin/audit' },
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
        {/* Public Website (synapseos.tech) */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<SimplePage />} />
        <Route path="/sdg" element={<SimplePage />} />
        <Route path="/pricing" element={<SimplePage />} />
        <Route path="/demo" element={<DemoSandbox />} />
        <Route path="/demo/:role" element={<DemoSandbox />} />
        <Route path="/about" element={<SimplePage />} />
        <Route path="/blog" element={<SimplePage />} />
        <Route path="/blog/:slug" element={<SimplePage />} />
        <Route path="/contact" element={<SimplePage />} />
        <Route path="/careers" element={<SimplePage />} />
        <Route path="/press" element={<SimplePage />} />
        <Route path="/changelog" element={<SimplePage />} />
        <Route path="/status" element={<SimplePage />} />
        <Route path="/docs" element={<SimplePage />} />
        <Route path="/apply" element={<PilotApply />} />
        <Route path="/apply/thank-you" element={<SimplePage />} />
        <Route path="/apply-professional" element={<SimplePage />} />

        {/* Legal */}
        <Route path="/legal/privacy" element={<SimplePage />} />
        <Route path="/legal/terms" element={<SimplePage />} />
        <Route path="/legal/dpa" element={<SimplePage />} />
        <Route path="/legal/cookie-policy" element={<SimplePage />} />
        <Route path="/legal/accessibility" element={<SimplePage />} />
        <Route path="/legal/consent-withdrawal" element={<SimplePage />} />

        {/* FHIR API stubs */}
        <Route path="/fhir/metadata" element={<SimplePage />} />
        <Route path="/fhir/Patient/:id" element={<SimplePage />} />
        <Route path="/fhir/Observation" element={<SimplePage />} />
        <Route path="/fhir/Condition" element={<SimplePage />} />
        <Route path="/fhir/MedicationRequest" element={<SimplePage />} />
        <Route path="/fhir/DiagnosticReport" element={<SimplePage />} />
        <Route path="/fhir/Immunization" element={<SimplePage />} />
        <Route path="/fhir/Encounter" element={<SimplePage />} />
        <Route path="/fhir/AllergyIntolerance" element={<SimplePage />} />

        {/* International Medical ID */}
        <Route path="/imid/:code" element={<SimplePage />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<SimplePage />} />
        <Route path="/reset-password" element={<SimplePage />} />
        <Route path="/verify-email" element={<SimplePage />} />
        <Route path="/invite/:token" element={<SimplePage />} />
        <Route path="/unauthorized" element={<SimplePage />} />

        {/* Onboarding */}
        <Route path="/onboarding" element={<SimplePage />} />
        <Route path="/onboarding/departments" element={<SimplePage />} />
        <Route path="/onboarding/staff" element={<SimplePage />} />
        <Route path="/onboarding/billing" element={<SimplePage />} />
        <Route path="/onboarding/pharmacy" element={<SimplePage />} />
        <Route path="/onboarding/insurance" element={<SimplePage />} />
        <Route path="/onboarding/guidelines" element={<SimplePage />} />
        <Route path="/onboarding/complete" element={<SimplePage />} />

        {/* OS Doctor Workspace */}
        <Route path="/doctor/queue" element={<OSLayout><DoctorQueue /></OSLayout>} />
        <Route path="/doctor/schedule" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/doctor/tele" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/doctor/rounds" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/doctor/notes" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/doctor/orders" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/doctor/ai" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/doctor/consults" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/doctor/referrals" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/doctor/reports" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Encounter */}
        <Route path="/encounter/new" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/encounter/:id" element={<OSLayout><EncounterScreen /></OSLayout>} />
        <Route path="/encounter/:id/history" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/encounter/:id/scoring" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/encounter/:id/orders" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/encounter/:id/notes" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/encounter/:id/sign" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Nurse Workspace */}
        <Route path="/nurse/ward" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/nurse/vitals" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/nurse/mar" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/nurse/beds" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/nurse/handover" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/nurse/observations" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/nurse/procedures" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Laboratory */}
        <Route path="/lab/orders" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/lab/specimens" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/lab/results" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/lab/verify" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/lab/qc" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/lab/instruments" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/lab/reports" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Pharmacy */}
        <Route path="/pharmacy/queue" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/pharmacy/dispense" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/pharmacy/inventory" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/pharmacy/expiry" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/pharmacy/nms" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/pharmacy/interactions" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/pharmacy/reports" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Radiology */}
        <Route path="/radiology/orders" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/radiology/results" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/radiology/reports" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Departments */}
        <Route path="/dept/maternity/anc" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/maternity/labour" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/maternity/postnatal" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/paediatrics/queue" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/paediatrics/growth" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/paediatrics/immunisation" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/hiv/dashboard" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/hiv/enrolments" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/hiv/art" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/hiv/vl" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/ae/triage" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/ae/resus" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/theatre/schedule" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/theatre/checklist" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/icu/dashboard" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/icu/flowsheet" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/icu/scoring" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/cardiology/ecg" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/cardiology/scores" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/mental/assessments" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/mental/risk" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/oncology/staging" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/oncology/chemo" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/dialysis/sessions" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/carepath/plans" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/community/chw" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/dept/community/map" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Clinical Scoring Hub */}
        <Route path="/scores" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/scores/:code" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/scores/:code/trend" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Telemedicine */}
        <Route path="/tele" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/tele/room/:id" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Admin */}
        <Route path="/admin" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/staff" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/staff/invite" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/beds" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/departments" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/finance" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/finance/invoices" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/finance/payments" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/insurance" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/insurance/claims" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/insurance/appeals" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/supply" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/supply/orders" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/hr" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/hr/schedules" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/hr/attendance" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/hr/payroll" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/audit" element={<OSLayout><AuditLog /></OSLayout>} />
        <Route path="/admin/settings" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/settings/domain" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/settings/branding" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/settings/guidelines" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/admin/lab" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS SDG & Public Health */}
        <Route path="/sdg" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/sdg/goal/:number" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/sdg/reports" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/epidemiology" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/epidemiology/alerts" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/epidemiology/outbreaks" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/epidemiology/dhis2" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Patient Portal */}
        <Route path="/patient/dashboard" element={<OSLayout><PatientDashboard /></OSLayout>} />
        <Route path="/patient/appointments" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/patient/records" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/patient/labs" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/patient/meds" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/patient/immunisation" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/patient/bills" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/patient/messages" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/patient/devices" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/patient/medical-id" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/patient/consent" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Peer Consultation */}
        <Route path="/consults" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/consults/new" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/consults/:id" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/consults/:id/call" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* OS Referrals */}
        <Route path="/referrals" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/referrals/outgoing" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/referrals/incoming" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/referrals/new" element={<OSLayout><SimplePage /></OSLayout>} />
        <Route path="/referrals/:id" element={<OSLayout><SimplePage /></OSLayout>} />

        {/* Synapse App Routes */}
        <Route path="/app/dashboard" element={<PatientDashboard />} />
        <Route path="/records/labs" element={<SimplePage />} />
        <Route path="/records/labs/:id" element={<SimplePage />} />
        <Route path="/records/visits/:id" element={<SimplePage />} />
        <Route path="/records/prescriptions" element={<SimplePage />} />
        <Route path="/records/conditions" element={<SimplePage />} />
        <Route path="/records/allergies" element={<SimplePage />} />
        <Route path="/children" element={<SimplePage />} />
        <Route path="/children/add" element={<SimplePage />} />
        <Route path="/children/:id" element={<SimplePage />} />
        <Route path="/children/:id/growth" element={<SimplePage />} />
        <Route path="/children/:id/immunisation" element={<SimplePage />} />
        <Route path="/children/:id/anc" element={<SimplePage />} />
        <Route path="/tele/chatbot" element={<SimplePage />} />
        <Route path="/tele/booking/:doctorId" element={<SimplePage />} />
        <Route path="/tele/booked/:id" element={<SimplePage />} />
        <Route path="/tele/room/:id" element={<SimplePage />} />
        <Route path="/devices/connect" element={<SimplePage />} />
        <Route path="/devices/:id" element={<SimplePage />} />
        <Route path="/devices/affiliations" element={<SimplePage />} />
        <Route path="/insurance" element={<SimplePage />} />
        <Route path="/insurance/add" element={<SimplePage />} />
        <Route path="/insurance/:id" element={<SimplePage />} />
        <Route path="/medications" element={<SimplePage />} />
        <Route path="/medications/:id" element={<SimplePage />} />
        <Route path="/medications/log/:scheduleId" element={<SimplePage />} />
        <Route path="/assessments" element={<SimplePage />} />
        <Route path="/assessments/phq9" element={<SimplePage />} />
        <Route path="/assessments/gad7" element={<SimplePage />} />
        <Route path="/assessments/audit" element={<SimplePage />} />
        <Route path="/assessments/findrisc" element={<SimplePage />} />
        <Route path="/assessments/:id/result" element={<SimplePage />} />
        <Route path="/public-health" element={<SimplePage />} />
        <Route path="/public-health/outbreaks" element={<SimplePage />} />
        <Route path="/public-health/district" element={<SimplePage />} />
        <Route path="/public-health/calendar" element={<SimplePage />} />
        <Route path="/medical-id" element={<SimplePage />} />
        <Route path="/medical-id/qr" element={<SimplePage />} />
        <Route path="/medical-id/access-log" element={<SimplePage />} />
        <Route path="/medical-id/settings" element={<SimplePage />} />
        <Route path="/messages" element={<SimplePage />} />
        <Route path="/messages/:id" element={<SimplePage />} />
        <Route path="/messages/new" element={<SimplePage />} />
        <Route path="/emergency" element={<SimplePage />} />
        <Route path="/profile/settings" element={<SimplePage />} />
        <Route path="/profile/consent" element={<SimplePage />} />
        <Route path="/profile/language" element={<SimplePage />} />
        <Route path="/profile/notifications" element={<SimplePage />} />
        <Route path="/profile/affiliations" element={<SimplePage />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
