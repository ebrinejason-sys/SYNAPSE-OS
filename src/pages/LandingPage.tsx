import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion, useInView } from 'motion/react';
import {
  Shield, Activity, Users, Zap, CheckCircle, ArrowRight,
  Github, Linkedin, Mail, BrainCircuit, Wifi, Globe2, Lock,
  Award, ChevronDown, Menu, X, TrendingUp, Heart, FileText,
  Stethoscope, AlertTriangle, Database, Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { SynapseLogo } from '../components/ui/SynapseLogo';

// ─── Fade-up animation variant ───────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

function FadeSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} variants={stagger} initial="hidden" animate={inView ? 'visible' : 'hidden'} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Live metric counter ──────────────────────────────────────────────────────
function CountUp({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const steps = 40;
    const inc = end / steps;
    let cur = 0;
    const t = setInterval(() => {
      cur += inc;
      if (cur >= end) { setVal(end); clearInterval(t); } else { setVal(Math.floor(cur)); }
    }, 30);
    return () => clearInterval(t);
  }, [inView, end]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav className={cn(
      'fixed top-0 w-full z-50 transition-all duration-300',
      scrolled ? 'bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm' : 'bg-transparent'
    )}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" aria-label="SynapseOS home">
          <SynapseLogo variant="light" className="text-slate-900" />
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-500 uppercase tracking-widest">
          {[['Solution', '#solution'], ['Features', '#features'], ['Departments', '#departments'], ['Impact', '#impact'], ['Team', '#team'], ['Pricing', '#pricing']].map(([label, href]) => (
            <a key={label} href={href} className="hover:text-emerald-600 transition-colors">{label}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest">Sign In</Link>
          <Link to="/demo" className="border border-slate-200 text-slate-900 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-all">Live Demo</Link>
          <Link to="/apply" className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg">Apply for Pilot</Link>
        </div>

        <button type="button" onClick={() => setOpen(!open)} className="md:hidden p-2" aria-label="Toggle menu">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden bg-white border-t border-slate-100 px-6 py-6 flex flex-col gap-6">
          {[['Solution', '#solution'], ['Features', '#features'], ['Departments', '#departments'], ['Impact', '#impact'], ['Team', '#team'], ['Pricing', '#pricing']].map(([label, href]) => (
            <a key={label} href={href} onClick={() => setOpen(false)} className="text-sm font-bold text-slate-700 uppercase tracking-widest">{label}</a>
          ))}
          <Link to="/demo" onClick={() => setOpen(false)} className="btn-secondary text-center text-xs">Live Demo</Link>
          <Link to="/apply" onClick={() => setOpen(false)} className="bg-slate-900 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-center">Apply for Pilot</Link>
        </motion.div>
      )}
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="min-h-screen bg-[#060D1A] flex flex-col items-center justify-center px-6 pt-24 pb-16 relative overflow-hidden">
      {/* Animated background grid */}
      <div className="hero-grid-bg absolute inset-0 opacity-10 pointer-events-none" />

      {/* Glow blobs */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold uppercase tracking-[0.25em] border border-teal-500/20 mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
          </span>
          Built in Uganda &nbsp;·&nbsp; Designed for the World
        </motion.div>

        <motion.h1 variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.2 }}
          className="font-syne text-5xl sm:text-7xl font-black text-white leading-[1.0] tracking-tighter mb-6">
          The AI brain<br />
          <span className="bg-gradient-to-r from-teal-400 to-sky-400 bg-clip-text text-transparent">
            for African healthcare.
          </span>
        </motion.h1>

        <motion.p variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.35 }}
          className="text-lg text-slate-400 mb-4 max-w-2xl mx-auto leading-relaxed font-medium">
          SynapseOS is the first AI-powered hospital operating system built specifically for African healthcare infrastructure — grounded in national clinical guidelines, offline-first, ICD-11 coded.
        </motion.p>

        <motion.p variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.4 }}
          className="text-sm text-teal-400 mb-10 font-semibold tracking-wide">
          AI Diagnosis · Device Monitoring · Insurance Automation · Offline-First · Works on 2G · Speaks Luganda
        </motion.p>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.5 }}
          className="flex flex-wrap gap-4 justify-center">
          <Link to="/demo"
            className="bg-gradient-to-r from-teal-500 to-sky-500 text-white px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-teal-500/25 flex items-center gap-2">
            Launch Interactive Demo <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/apply"
            className="border border-white/20 bg-white/5 text-white px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
            Apply for Pilot Access
          </Link>
        </motion.div>

        {/* Metrics bar */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.65 }}
          className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/10">
          {[
            { label: 'AI Diagnosis Concordance', value: 94, suffix: '%' },
            { label: 'Clinical Guidelines Loaded', value: 18, suffix: '' },
            { label: 'Demo Patients (Live DB)', value: 11, suffix: '' },
            { label: 'Uptime', value: 99, suffix: '.9%' },
          ].map(({ label, value, suffix }) => (
            <div key={label} className="bg-white/3 px-6 py-5 text-center">
              <div className="font-jb-mono text-2xl font-black text-teal-400 mb-1">
                <CountUp end={value} suffix={suffix} />
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-600 animate-bounce">
        <ChevronDown className="w-6 h-6" />
      </div>
    </section>
  );
}

// ─── Problem statement ────────────────────────────────────────────────────────
function Problem() {
  return (
    <section className="bg-white py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="text-xs font-bold text-rose-500 uppercase tracking-[0.3em] mb-4">The Problem</p>
            <h2 className="font-syne text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Africa's hospitals are running<br />on paper and guesswork.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                stat: '70%',
                label: 'of sub-Saharan hospitals still use paper records',
                detail: 'Lost files, duplicate patients, and zero clinical history when it matters most.',
                color: 'rose',
              },
              {
                stat: '3.6M',
                label: 'preventable deaths per year from misdiagnosis',
                detail: 'No decision-support tools. No clinical guidelines at point of care. Doctors guessing alone.',
                color: 'orange',
              },
              {
                stat: '$9B',
                label: 'lost annually to insurance claim fraud & errors',
                detail: 'Manual claim submission, no coding standard, no audit trail. Facilities absorb the loss.',
                color: 'amber',
              },
            ].map(({ stat, label, detail, color }) => (
              <motion.div key={stat} variants={fadeUp} className="p-8 rounded-2xl border border-slate-100 bg-slate-50">
                <div className={cn('font-jb-mono text-5xl font-black mb-3 tracking-tight', `text-${color}-500`)}>{stat}</div>
                <p className="font-bold text-slate-900 mb-2">{label}</p>
                <p className="text-slate-500 text-sm leading-relaxed">{detail}</p>
              </motion.div>
            ))}
          </div>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Solution / AI workspace ──────────────────────────────────────────────────
function Solution() {
  return (
    <section className="bg-[#060D1A] py-24 px-6" id="solution">
      <div className="max-w-6xl mx-auto">
        <FadeSection>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — copy */}
            <div>
              <motion.p variants={fadeUp} className="text-xs font-bold text-teal-400 uppercase tracking-[0.3em] mb-4">AI Clinical Workspace</motion.p>
              <motion.h2 variants={fadeUp} className="font-syne text-4xl font-black text-white tracking-tight leading-tight mb-6">
                The AI that never works<br />without evidence.
              </motion.h2>
              <motion.p variants={fadeUp} className="text-slate-400 leading-relaxed mb-8">
                Before every diagnosis, SynapseOS loads Uganda Clinical Guidelines, retrieves top evidence for the patient's complaint, and grounds every suggestion in published national protocols. The AI sees what you see — and it cites its sources.
              </motion.p>
              <motion.ul variants={stagger} className="space-y-4 mb-10">
                {[
                  'Grounded in Uganda Clinical Guidelines 2023 (18 protocols loaded)',
                  'ICD-11 coded — globally interoperable from day one',
                  'Confidence % shown for every differential diagnosis',
                  'Doctor accepts, modifies, or overrides — AI never decides alone',
                  'Drug interaction checks + allergy cross-reference on every order',
                ].map(item => (
                  <motion.li key={item} variants={fadeUp} className="flex items-start gap-3 text-sm text-slate-300">
                    <CheckCircle className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                    {item}
                  </motion.li>
                ))}
              </motion.ul>
              <motion.div variants={fadeUp}>
                <Link to="/demo/doctor" className="inline-flex items-center gap-2 text-teal-400 font-bold text-sm hover:text-teal-300 transition-colors">
                  See the live encounter screen <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>

            {/* Right — AI diagnosis mockup */}
            <motion.div variants={fadeUp} className="relative">
              <div className="animate-float bg-[#0B1628] rounded-2xl border border-white/10 p-6 shadow-2xl">
                <div className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4" /> AI Diagnosis Results
                </div>

                {[
                  { rank: 1, icd: '1F40', name: 'Plasmodium falciparum malaria', confidence: 87, color: 'emerald' },
                  { rank: 2, icd: '1A07', name: 'Typhoid fever', confidence: 58, color: 'yellow' },
                  { rank: 3, icd: 'CA40', name: 'Community-acquired pneumonia', confidence: 28, color: 'orange' },
                ].map(({ rank, icd, name, confidence, color }) => (
                  <div key={icd} className="mb-4 p-4 bg-white/5 rounded-xl border border-white/8">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white/10 text-white text-[10px] font-black flex items-center justify-center">{rank}</span>
                        <span className="text-[10px] font-mono text-slate-400">{icd}</span>
                        <span className="text-sm font-semibold text-white">{name}</span>
                      </div>
                      <span className={cn('text-xs font-black', `text-${color}-400`)}>{confidence}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-in-out', color === 'emerald' ? 'from-teal-500 to-emerald-400' : color === 'yellow' ? 'from-yellow-500 to-amber-400' : 'from-orange-500 to-red-400')}
                        style={{ width: `${confidence}%` }} />
                    </div>
                  </div>
                ))}

                <div className="mt-4 p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-xs text-teal-300">
                  <span className="font-bold">UCG Recommendation:</span> Artemether-Lumefantrine (AL) 4 tabs BD × 3 days with fatty food. Confirm with mRDT.
                </div>

                <div className="mt-3 flex gap-2">
                  <button type="button" className="flex-1 py-2 bg-teal-500 text-white text-xs font-bold rounded-lg">✓ Accept</button>
                  <button type="button" className="flex-1 py-2 bg-white/10 text-white text-xs font-bold rounded-lg">✏ Modify</button>
                  <button type="button" className="flex-1 py-2 bg-white/5 text-slate-400 text-xs font-bold rounded-lg">Override</button>
                </div>
              </div>
            </motion.div>
          </div>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Trust badges ─────────────────────────────────────────────────────────────
function TrustBadges() {
  const badges = [
    { icon: Shield, text: 'Uganda DPPA 2019 Compliant' },
    { icon: Wifi, text: 'Offline-First — Works on 2G' },
    { icon: BrainCircuit, text: '94% Diagnostic Concordance' },
    { icon: Globe2, text: 'ICD-11 WHO Standard' },
    { icon: Lock, text: 'End-to-End Encrypted' },
    { icon: Award, text: 'UGX 37M STI-OP Funded' },
  ];
  return (
    <section className="bg-slate-950 py-16 px-6 border-y border-white/5">
      <FadeSection className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {badges.map(({ icon: Icon, text }) => (
          <motion.div key={text} variants={fadeUp}
            className="flex flex-col items-center text-center gap-2 p-4 rounded-xl bg-white/3 border border-white/8">
            <Icon className="w-5 h-5 text-teal-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{text}</span>
          </motion.div>
        ))}
      </FadeSection>
    </section>
  );
}

// ─── Features grid ────────────────────────────────────────────────────────────
function Features() {
  const features = [
    { icon: Stethoscope, title: 'Clinical AI Copilot', desc: 'Grounded in Uganda Clinical Guidelines (UCG). Real-time differential diagnosis with ICD-11 coding, confidence scores, and mandatory doctor sign-off.' },
    { icon: Zap, title: 'Offline-First OS', desc: 'Continuous clinical operation regardless of internet. Peer-to-peer local sync with encrypted cloud backup when connectivity restores.' },
    { icon: Shield, title: 'Insurance Copilot', desc: 'Automated ICD-11 claim coding, real-time coverage checks for UNHIS, AAR, IAA and 12 regional providers. Reduces claim rejections by 60%.' },
    { icon: Activity, title: 'Live Vitals & IoT', desc: 'Integrates with bedside monitors, pulse oximeters, and glucometers via OpenICE. Anomaly detection with nurse alerts in real time.' },
    { icon: Users, title: 'Community Health', desc: 'CHW mobile app with MUAC screening, catchment mapping, SMS reminders. Connects village-level workers to the hospital system.' },
    { icon: FileText, title: 'One-Click MOH Reports', desc: 'HMIS 105 and 106 reports auto-generated from clinical data. Formatted to Ministry of Health standards. One click, ready to submit.' },
    { icon: Database, title: 'FHIR & HL7 Ready', desc: 'Built on open standards from day one. Connect to NHIS, national EMR, labs, and cross-border referral networks without custom integration.' },
    { icon: Layers, title: 'Multi-Tenant Architecture', desc: 'Each hospital gets its own isolated data environment. Platform admin dashboard for national-level oversight and benchmarking.' },
    { icon: TrendingUp, title: 'SDG Dashboard', desc: '17 Sustainable Development Goal indicators tracked automatically from clinical data. Exportable for donor reporting and MOH submissions.' },
  ];

  return (
    <section id="features" className="bg-white py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="mb-16">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-[0.3em] mb-4">Core Ecosystem</p>
            <h2 className="font-syne text-4xl font-black text-slate-900 tracking-tight">Resilient Clinical Intelligence.</h2>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp}
                className="p-8 rounded-2xl border border-slate-100 bg-white hover:shadow-xl hover:shadow-slate-100 hover:border-emerald-100 hover:-translate-y-1 transition-all group">
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-all mb-6">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-3 text-slate-900">{title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{desc}</p>
              </motion.div>
            ))}
          </div>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Departments ──────────────────────────────────────────────────────────────
function Departments() {
  const depts = [
    { emoji: '🏥', title: 'National & Referral Hospitals', points: ['FHIR bundle export', 'Cross-tenant records', 'National bed queue'] },
    { emoji: '🧪', title: 'District Hospitals', points: ['Full OPD + pharmacy + lab', 'Works on 2G', 'Offline-capable'] },
    { emoji: '👶', title: 'Maternity & Paediatrics', points: ['ANC schedule tracking', 'APGAR + PEWS scores', 'Immunisation records'] },
    { emoji: '💊', title: 'Pharmacy & Inventory', points: ['FEFO dispensing', 'Drug interaction alerts', 'Auto reorder triggers'] },
    { emoji: '📱', title: 'Clinics & Health Centres', points: ['Set up in 24 hours', 'Grows with you', 'Patient SMS reminders'] },
    { emoji: '🌍', title: 'Community Health', points: ['CHW mobile app', 'Catchment mapping', 'MUAC screening'] },
  ];

  return (
    <section id="departments" className="bg-slate-50 py-24 px-6 border-y border-slate-100">
      <div className="max-w-7xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">Departments</p>
            <h2 className="font-syne text-4xl font-black text-slate-900 tracking-tight">Every department. Every workflow.</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {depts.map(({ emoji, title, points }) => (
              <motion.div key={title} variants={fadeUp}
                className="bg-white p-7 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:-translate-y-1 transition-all shadow-sm hover:shadow-md">
                <div className="text-3xl mb-4">{emoji}</div>
                <h3 className="font-bold text-slate-900 mb-3">{title}</h3>
                <ul className="space-y-1.5">
                  {points.map(p => (
                    <li key={p} className="text-sm text-slate-500 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── SDG Impact ───────────────────────────────────────────────────────────────
function Impact() {
  const sdgs = [
    { num: 1, title: 'No Poverty', val: 68, color: '#E5243B' },
    { num: 3, title: 'Good Health', val: 94, color: '#4C9F38' },
    { num: 4, title: 'Quality Education', val: 55, color: '#C5192D' },
    { num: 5, title: 'Gender Equality', val: 71, color: '#FF3A21' },
    { num: 8, title: 'Economic Growth', val: 60, color: '#A21942' },
    { num: 10, title: 'Reduced Inequality', val: 78, color: '#DD1367' },
    { num: 13, title: 'Climate Action', val: 42, color: '#3F7E44' },
    { num: 17, title: 'Partnerships', val: 83, color: '#19486A' },
  ];

  return (
    <section id="impact" className="bg-[#060D1A] py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="text-xs font-bold text-teal-400 uppercase tracking-[0.3em] mb-4">SDG Impact</p>
            <h2 className="font-syne text-4xl font-black text-white tracking-tight">Every encounter counts toward<br />the Sustainable Development Goals.</h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto text-sm">Every clinical action is automatically mapped to SDG indicators — giving hospitals, donors, and governments real-time health impact data.</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {sdgs.map(({ num, title, val, color }) => (
              <motion.div key={num} variants={fadeUp}
                className="bg-white/5 border border-white/10 rounded-xl p-5 text-center hover:bg-white/8 transition-colors">
                <div className="text-2xl font-black mb-1" style={{ color }}>{num}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">{title}</div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, backgroundColor: color }} />
                </div>
                <div className="text-xs font-mono text-slate-300 mt-2">{val}%</div>
              </motion.div>
            ))}
          </div>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Demo CTA ─────────────────────────────────────────────────────────────────
function DemoCTA() {
  return (
    <section className="bg-white py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-12 text-center border border-slate-700">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 text-teal-400 text-xs font-bold uppercase tracking-widest border border-teal-500/20 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
              </span>
              Live Demo — Real Patient Data
            </div>
            <h2 className="font-syne text-3xl font-black text-white mb-4 tracking-tight">
              See SynapseOS with 11 real patients<br />from Mengo Hospital.
            </h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto text-sm leading-relaxed">
              The demo pulls live data from our Supabase database — real triage statuses, real vitals, real UCG clinical guidelines. No mock data. No smoke and mirrors.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/demo/doctor"
                className="bg-gradient-to-r from-teal-500 to-sky-500 text-white px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-lg shadow-teal-500/25">
                Open Doctor Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/demo"
                className="border border-white/20 text-white px-8 py-4 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-white/5 transition-all">
                Choose a Role
              </Link>
            </div>
          </motion.div>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Testimonial ──────────────────────────────────────────────────────────────
function Testimonial() {
  return (
    <section className="bg-slate-50 py-20 px-6 border-y border-slate-100">
      <div className="max-w-3xl mx-auto text-center">
        <FadeSection>
          <motion.div variants={fadeUp}>
            <div className="text-6xl text-teal-200 font-serif mb-6">"</div>
            <p className="font-ibm text-xl font-medium text-slate-700 leading-relaxed mb-6">
              SynapseOS flagged a drug interaction I would have missed. The AI suggested checking blood glucose before I even thought to. This is what evidence-based medicine looks like in practice.
            </p>
            <div className="text-sm font-bold text-slate-900">Dr. Amina K.</div>
            <div className="text-xs text-slate-500 mt-1">Internal Medicine · Mulago National Referral Hospital · Pilot Participant</div>
          </motion.div>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────
function Team() {
  return (
    <section id="team" className="bg-white py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">The Architects</p>
            <h2 className="font-syne text-4xl font-black text-slate-900 tracking-tight">
              Built by Africans,<br /><span className="text-slate-400">for Africa.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-10 max-w-3xl mx-auto">
            {[
              {
                name: 'Tushabe Ebrine',
                role: 'Co-Founder & CEO / CTO',
                bio: 'Lead engineer who built the core clinical AI engine. Focused on infrastructure resilience, offline-first architecture, and clinical safety for high-stakes medical environments across East Africa.',
                img: '/assets/team/ebrine-tushabe.jpg',
                linkedin: '#',
                github: '#',
                showGithub: true,
              },
              {
                name: 'Nathan David',
                role: 'Co-Founder & COO',
                bio: 'Health financing analyst with regional expertise in hospital operations, insurance systems optimisation, and healthcare economics across East Africa. Drives our go-to-market and partnerships.',
                img: '/assets/team/nathan-david.jpg',
                linkedin: '#',
                email: 'contact@synapseos.tech',
                showGithub: false,
              },
            ].map(({ name, role, bio, img, linkedin, github, email, showGithub }) => (
              <motion.div key={name} variants={fadeUp}
                className="bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center text-center hover:shadow-lg hover:border-emerald-100 transition-all">
                <div className="w-32 h-32 rounded-full mb-6 border-4 border-white shadow-xl overflow-hidden">
                  <img src={img} alt={name} className="w-full h-full object-cover object-top" />
                </div>
                <h3 className="text-xl font-bold mb-1 text-slate-900">{name}</h3>
                <p className="text-emerald-600 font-bold text-xs mb-5 uppercase tracking-widest">{role}</p>
                <p className="text-slate-500 leading-relaxed text-sm mb-7">{bio}</p>
                <div className="flex gap-3">
                  <a href={linkedin} aria-label={`${name} on LinkedIn`}
                    className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-slate-400">
                    <Linkedin className="w-4 h-4" />
                  </a>
                  {showGithub && github && (
                    <a href={github} aria-label={`${name} on GitHub`}
                      className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-slate-400">
                      <Github className="w-4 h-4" />
                    </a>
                  )}
                  {!showGithub && email && (
                    <a href={`mailto:${email}`} aria-label={`Email ${name}`}
                      className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-slate-400">
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function Pricing() {
  const plans = [
    {
      name: 'Starter', price: 'Free', sub: '30-day pilot',
      features: ['Up to 20 beds', '10 staff accounts', 'Core OPD + Pharmacy', 'AI Copilot (100 calls/day)', 'Offline mode'],
      cta: 'Start Free Trial', href: '/apply?plan=trial', highlight: false,
    },
    {
      name: 'Professional', price: 'UGX 750K', sub: '/month',
      features: ['Up to 200 beds', 'Unlimited staff', 'All clinical modules', 'Insurance Copilot', 'AI (2,000 calls/day)', 'FHIR API access', 'SDG dashboard'],
      cta: 'Apply for Professional', href: '/apply?plan=professional', highlight: true,
    },
    {
      name: 'Enterprise', price: 'Custom', sub: 'Unlimited everything',
      features: ['Unlimited beds & staff', 'Custom integrations', 'HMIS national bridge', 'Dedicated SLA', '24/7 support', 'On-premise option'],
      cta: 'Contact Us', href: '/contact', highlight: false,
    },
  ];

  return (
    <section id="pricing" className="bg-slate-950 py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="text-xs font-bold text-teal-400 uppercase tracking-[0.3em] mb-4">Pricing</p>
            <h2 className="font-syne text-4xl font-black text-white tracking-tight">Priced for African healthcare economics.</h2>
            <p className="text-slate-400 mt-3 text-sm">No hidden fees. No per-seat charges. Cancel any time.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map(({ name, price, sub, features, cta, href, highlight }) => (
              <motion.div key={name} variants={fadeUp}
                className={cn(
                  'p-8 rounded-2xl border transition-all relative',
                  highlight
                    ? 'bg-gradient-to-b from-teal-900/40 to-slate-900 border-teal-500 shadow-2xl shadow-teal-500/10 scale-105 z-10'
                    : 'bg-white/5 border-white/10'
                )}>
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-teal-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full">Most Popular</div>
                )}
                <div className="text-xs font-black text-teal-400 uppercase tracking-widest mb-4">{name}</div>
                <div className="text-4xl font-black text-white tracking-tight mb-1">{price}</div>
                <div className="text-xs text-slate-400 mb-8">{sub}</div>
                <ul className="space-y-3 mb-10">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to={href}
                  className={cn(
                    'w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest block text-center transition-all',
                    highlight ? 'bg-teal-500 text-white hover:bg-teal-400' : 'bg-white/10 text-white hover:bg-white/20'
                  )}>
                  {cta}
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.p variants={fadeUp} className="text-center text-xs text-slate-500 mt-8">
            All plans include offline mode · ICD-11 coding · UCG-grounded AI · Uganda DPPA 2019 compliance
          </motion.p>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Apply CTA banner ─────────────────────────────────────────────────────────
function ApplyCTA() {
  return (
    <section className="bg-white py-20 px-6">
      <FadeSection className="max-w-4xl mx-auto">
        <motion.div variants={fadeUp}
          className="rounded-3xl bg-gradient-to-br from-teal-500/15 to-sky-500/15 border border-teal-500/20 p-16 text-center">
          <h2 className="font-syne text-4xl font-black text-slate-900 mb-4 tracking-tight">
            Ready to bring AI to your facility?
          </h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            Join our pilot programme. First 20 facilities get free onboarding support, data migration, and 90 days free.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/apply"
              className="bg-gradient-to-r from-teal-500 to-sky-500 text-white px-10 py-4 rounded-xl font-bold text-sm uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-teal-500/25">
              Apply for Pilot Access
            </Link>
            <Link to="/contact"
              className="border border-slate-200 text-slate-900 px-10 py-4 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-slate-50 transition-all">
              Talk to Us
            </Link>
          </div>
        </motion.div>
      </FadeSection>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-[#060D1A] border-t border-white/8 py-20 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
        <div className="col-span-2">
          <Link to="/" aria-label="SynapseOS home">
            <SynapseLogo variant="dark" className="text-white mb-6" />
          </Link>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-6">
            The AI operating system for African healthcare. Closing the clinical intelligence gap — one hospital at a time.
          </p>
          <div className="flex gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>Est. 2024</span>
            <span>Built in Kampala 🇺🇬</span>
          </div>
        </div>

        {[
          { heading: 'Platform', links: [['Features', '/features'], ['Live Demo', '/demo'], ['Pricing', '/pricing'], ['API Docs', '/docs']] },
          { heading: 'Company', links: [['About', '/about'], ['Blog', '/blog'], ['Careers', '/careers'], ['Contact', '/contact']] },
          { heading: 'Legal', links: [['Privacy', '/privacy'], ['Terms', '/terms'], ['DPA', '/dpa'], ['Consent', '/consent']] },
        ].map(({ heading, links }) => (
          <div key={heading}>
            <h4 className="text-[10px] font-black text-white uppercase tracking-[0.25em] mb-6">{heading}</h4>
            <ul className="space-y-3">
              {links.map(([label, href]) => (
                <li key={label}>
                  <Link to={href} className="text-sm text-slate-400 hover:text-teal-400 font-medium transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-white/8 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest text-center md:text-left">
          © 2026 Synapse Health Technologies Ltd. · Kampala, Uganda.
        </p>
        <p className="text-xs text-slate-600 tracking-wide text-center">
          Uganda DPPA 2019 Compliant · ISO 27001 Aligned · ICD-11 WHO Standard
        </p>
        <Link to="/status" className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-teal-400 transition-colors uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Network Active
        </Link>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="font-sans selection:bg-teal-100 selection:text-teal-900">
      <Navbar />
      <Hero />
      <Problem />
      <Solution />
      <TrustBadges />
      <Features />
      <Departments />
      <Impact />
      <DemoCTA />
      <Testimonial />
      <Team />
      <Pricing />
      <ApplyCTA />
      <Footer />
    </div>
  );
}
