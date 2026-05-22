import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion, useInView } from 'motion/react';
import {
  Shield, Activity, Users, Zap, CheckCircle, ArrowRight,
  Github, Linkedin, Mail, BrainCircuit, Wifi, Globe2, Lock,
  Award, ChevronDown, Menu, X, TrendingUp, FileText,
  Stethoscope, Database, Layers, Sparkles, Heart
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { SynapseLogo } from '../components/ui/SynapseLogo';

// ─── Shared animation variants ────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

function FadeSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} variants={stagger} initial="hidden" animate={inView ? 'visible' : 'hidden'} className={className}>
      {children}
    </motion.div>
  );
}

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
      if (cur >= end) { setVal(end); clearInterval(t); }
      else { setVal(Math.floor(cur)); }
    }, 28);
    return () => clearInterval(t);
  }, [inView, end]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  ['Solution', '#solution'],
  ['Features', '#features'],
  ['Departments', '#departments'],
  ['Impact', '#impact'],
  ['Pricing', '#pricing'],
] as const;

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav className={cn(
      'fixed top-0 inset-x-0 z-50 transition-all duration-300',
      scrolled
        ? 'bg-ink/90 backdrop-blur-xl border-b border-edge shadow-[0_1px_0_0_rgba(255,255,255,0.05)]'
        : 'bg-transparent'
    )}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" aria-label="SynapseOS home">
          <SynapseLogo variant="dark" />
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(([label, href]) => (
            <a key={label} href={href}
              className="text-[11px] font-bold text-text-3 hover:text-gold transition-colors uppercase tracking-[0.15em]">
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login"
            className="text-[11px] font-bold text-text-3 hover:text-text-1 transition-colors uppercase tracking-widest px-3 py-2">
            Sign In
          </Link>
          <Link to="/demo"
            className="btn-outline text-[11px] px-4 py-2">
            Live Demo
          </Link>
          <Link to="/apply"
            className="btn-primary text-[11px] px-4 py-2">
            Apply for Pilot
          </Link>
        </div>

        <button type="button" onClick={() => setOpen(!open)} className="md:hidden p-2 text-text-2">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-surface-1 border-t border-edge px-6 py-6 flex flex-col gap-5">
          {NAV_LINKS.map(([label, href]) => (
            <a key={label} href={href} onClick={() => setOpen(false)}
              className="text-sm font-bold text-text-2 hover:text-gold transition-colors uppercase tracking-widest">
              {label}
            </a>
          ))}
          <Link to="/demo" onClick={() => setOpen(false)} className="btn-outline text-center text-xs w-full">Live Demo</Link>
          <Link to="/apply" onClick={() => setOpen(false)} className="btn-primary text-center text-xs w-full">Apply for Pilot</Link>
        </motion.div>
      )}
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="min-h-screen bg-ink flex flex-col items-center justify-center px-6 pt-24 pb-16 relative overflow-hidden">
      {/* Grid background */}
      <div className="hero-grid absolute inset-0 opacity-100 pointer-events-none" />

      {/* Gold glow orbs */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-gold/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Live badge */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/20 mb-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inset-0 rounded-full bg-gold opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
          </span>
          <span className="text-[10px] font-black text-gold uppercase tracking-[0.25em]">
            Built in Uganda &nbsp;·&nbsp; Designed for the World
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1 variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.2 }}
          className="font-display text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-8">
          <span className="text-text-1">The AI brain<br />for African</span>{' '}
          <span className="text-gold-gradient">healthcare.</span>
        </motion.h1>

        {/* Sub */}
        <motion.p variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.35 }}
          className="text-lg text-text-2 mb-4 max-w-2xl mx-auto leading-relaxed">
          An AI-powered hospital operating system built for African infrastructure — grounded in national clinical guidelines, offline-first, ICD-11 coded.
        </motion.p>

        <motion.p variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.42 }}
          className="text-xs text-gold/70 mb-10 font-mono tracking-[0.15em] uppercase">
          AI Diagnosis · Insurance Automation · Offline-First · Works on 2G · Speaks Luganda
        </motion.p>

        {/* CTAs */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.5 }}
          className="flex flex-wrap gap-4 justify-center">
          <Link to="/demo"
            className="btn-primary px-8 py-4 text-sm flex items-center gap-2 shadow-[0_8px_32px_rgba(232,184,75,0.25)]">
            <Sparkles className="w-4 h-4" />
            Launch Interactive Demo
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/apply"
            className="btn-outline px-8 py-4 text-sm">
            Apply for Pilot Access
          </Link>
        </motion.div>

        {/* Metrics */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.65 }}
          className="mt-16 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-edge rounded-2xl border border-edge overflow-hidden">
          {[
            { label: 'AI Diagnostic Concordance', value: 94, suffix: '%' },
            { label: 'UCG Protocols Loaded',       value: 18, suffix: '' },
            { label: 'Live Demo Patients',          value: 11, suffix: '' },
            { label: 'Uptime SLA',                  value: 99, suffix: '.9%' },
          ].map(({ label, value, suffix }) => (
            <div key={label} className="bg-surface-1/60 px-6 py-5 text-center">
              <div className="font-mono text-2xl font-bold text-gold mb-1">
                <CountUp end={value} suffix={suffix} />
              </div>
              <div className="text-[9px] font-bold text-text-3 uppercase tracking-[0.18em] leading-tight">{label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-text-3 animate-bounce">
        <ChevronDown className="w-5 h-5" />
      </div>
    </section>
  );
}

// ─── Problem ──────────────────────────────────────────────────────────────────
function Problem() {
  const problems = [
    { stat: '70%',  color: 'text-red', label: 'of sub-Saharan hospitals still use paper records', detail: 'Lost files, duplicate patients, zero clinical history when it matters most.' },
    { stat: '3.6M', color: 'text-amber', label: 'preventable deaths per year from misdiagnosis', detail: 'No decision-support tools. No clinical guidelines at point of care. Doctors guessing alone.' },
    { stat: '$9B',  color: 'text-gold', label: 'lost annually to insurance fraud & errors', detail: 'Manual claim submission, no coding standard, no audit trail. Facilities absorb the loss.' },
  ];

  return (
    <section className="bg-surface-1 py-24 px-6 border-y border-edge">
      <div className="max-w-6xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="label-sm text-red mb-4">The Problem</p>
            <h2 className="font-display text-4xl font-bold text-text-1 tracking-tight">
              Africa's hospitals run on<br />paper and guesswork.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {problems.map(({ stat, color, label, detail }) => (
              <motion.div key={stat} variants={fadeUp}
                className="card p-8 border-edge hover:border-edge-strong transition-all">
                <div className={cn('font-mono text-5xl font-bold mb-4 tracking-tight', color)}>{stat}</div>
                <p className="font-display font-semibold text-text-1 mb-2 text-sm">{label}</p>
                <p className="text-text-3 text-sm leading-relaxed">{detail}</p>
              </motion.div>
            ))}
          </div>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Solution ─────────────────────────────────────────────────────────────────
function Solution() {
  return (
    <section id="solution" className="bg-ink py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeSection>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.p variants={fadeUp} className="label-sm text-gold mb-4">AI Clinical Workspace</motion.p>
              <motion.h2 variants={fadeUp}
                className="font-display text-4xl font-bold text-text-1 tracking-tight leading-tight mb-6">
                The AI that never<br />works without evidence.
              </motion.h2>
              <motion.p variants={fadeUp} className="text-text-2 leading-relaxed mb-8">
                Before every diagnosis, Synapse OS loads Uganda Clinical Guidelines, retrieves top evidence for the patient's complaint, and grounds every suggestion in published national protocols. The AI sees what you see — and cites its sources.
              </motion.p>

              <motion.ul variants={stagger} className="space-y-3.5 mb-10">
                {[
                  'Grounded in Uganda Clinical Guidelines 2023 — 18 protocols loaded',
                  'ICD-11 coded — globally interoperable from day one',
                  'Confidence % shown for every differential diagnosis',
                  'Doctor accepts, modifies, or overrides — AI never decides alone',
                  'Drug interaction checks + allergy cross-reference on every order',
                ].map(item => (
                  <motion.li key={item} variants={fadeUp}
                    className="flex items-start gap-3 text-sm text-text-2">
                    <CheckCircle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                    {item}
                  </motion.li>
                ))}
              </motion.ul>

              <motion.div variants={fadeUp}>
                <Link to="/demo/doctor"
                  className="inline-flex items-center gap-2 text-gold text-sm font-bold hover:text-text-1 transition-colors">
                  See the live encounter screen <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>

            {/* AI mockup card */}
            <motion.div variants={fadeUp} className="animate-float">
              <div className="card-elevated p-6 border-gold/20">
                <div className="flex items-center gap-2 mb-5">
                  <BrainCircuit className="w-4 h-4 text-gold" />
                  <span className="label-sm text-gold">Clinical Copilot · AI Diagnosis</span>
                </div>

                {[
                  { rank: 1, icd: '1F40', name: 'Plasmodium falciparum malaria', pct: 87, color: 'text-emerald', bar: 'bg-emerald' },
                  { rank: 2, icd: '1A07', name: 'Typhoid fever',                 pct: 58, color: 'text-amber',   bar: 'bg-amber-400' },
                  { rank: 3, icd: 'CA40', name: 'Community-acquired pneumonia',  pct: 28, color: 'text-red',     bar: 'bg-red' },
                ].map(({ rank, icd, name, pct, color, bar }) => (
                  <div key={icd} className="mb-4 p-4 bg-surface-3 rounded-xl border border-edge">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-edge-strong flex items-center justify-center text-[10px] font-black text-text-2 shrink-0">{rank}</span>
                        <span className="font-mono text-[10px] text-text-3 shrink-0">{icd}</span>
                        <span className="text-sm font-semibold text-text-1 truncate">{name}</span>
                      </div>
                      <span className={cn('font-mono text-xs font-bold shrink-0 ml-2', color)}>{pct}%</span>
                    </div>
                    <div className="h-1 bg-surface-1 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-1000', bar)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}

                <div className="p-3 bg-gold/10 border border-gold/20 rounded-xl text-xs text-text-2 mb-4">
                  <span className="font-bold text-gold">UCG Recommendation: </span>
                  Artemether-Lumefantrine (AL) 4 tabs BD × 3 days with fatty food. Confirm with mRDT.
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button type="button" className="py-2 bg-gold text-ink text-xs font-black rounded-lg hover:bg-gold-accent transition-colors">✓ Accept</button>
                  <button type="button" className="py-2 bg-surface-3 text-text-1 text-xs font-black rounded-lg border border-edge hover:border-gold/40 transition-colors">✏ Modify</button>
                  <button type="button" className="py-2 bg-surface-3 text-text-3 text-xs font-bold rounded-lg border border-edge hover:border-edge-strong transition-colors">Override</button>
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
    { icon: Shield,      text: 'Uganda DPPA 2019 Compliant' },
    { icon: Wifi,        text: 'Offline-First · Works on 2G' },
    { icon: BrainCircuit, text: '94% Diagnostic Concordance' },
    { icon: Globe2,      text: 'ICD-11 WHO Standard' },
    { icon: Lock,        text: 'End-to-End Encrypted' },
    { icon: Award,       text: 'STI-OP Government Funded' },
  ];

  return (
    <section className="bg-surface-1 py-12 px-6 border-y border-edge">
      <FadeSection className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {badges.map(({ icon: Icon, text }) => (
          <motion.div key={text} variants={fadeUp}
            className="flex flex-col items-center text-center gap-2 p-4 rounded-xl bg-surface-2 border border-edge hover:border-gold/30 transition-colors">
            <Icon className="w-4 h-4 text-gold" />
            <span className="text-[9px] font-bold text-text-3 uppercase tracking-wide leading-tight">{text}</span>
          </motion.div>
        ))}
      </FadeSection>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
function Features() {
  const features = [
    { icon: Stethoscope, title: 'Clinical AI Copilot',    desc: 'Real-time differential diagnosis grounded in Uganda Clinical Guidelines. ICD-11 coded with confidence scores and mandatory doctor sign-off.' },
    { icon: Zap,         title: 'Offline-First OS',       desc: 'Continuous clinical operation regardless of internet. Peer-to-peer local sync with encrypted cloud backup when connectivity restores.' },
    { icon: Shield,      title: 'Insurance Copilot',      desc: 'Automated ICD-11 claim coding, real-time coverage checks for UNHIS, AAR, IAA and 12 regional providers. Reduces claim rejections by 60%.' },
    { icon: Activity,    title: 'Live Vitals & IoT',      desc: 'Integrates with bedside monitors, pulse oximeters, and glucometers via OpenICE. Anomaly detection with nurse alerts in real time.' },
    { icon: Users,       title: 'Community Health',       desc: 'CHW mobile app with MUAC screening, catchment mapping, SMS reminders. Connects village-level workers to the hospital system.' },
    { icon: FileText,    title: 'One-Click MOH Reports',  desc: 'HMIS 105 and 106 reports auto-generated from clinical data. Formatted to Ministry of Health standards. One click, ready to submit.' },
    { icon: Database,    title: 'FHIR & HL7 Ready',       desc: 'Built on open standards from day one. Connect to NHIS, national EMR, labs, and cross-border referral networks.' },
    { icon: Layers,      title: 'Multi-Tenant',           desc: 'Each hospital gets its own isolated data environment. Platform admin for national-level oversight and benchmarking.' },
    { icon: TrendingUp,  title: 'SDG Dashboard',          desc: '17 SDG indicators tracked automatically from clinical data. Exportable for donor reporting and MOH submissions.' },
  ];

  return (
    <section id="features" className="bg-ink py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="mb-16">
            <p className="label-sm text-gold mb-4">Core Ecosystem</p>
            <h2 className="font-display text-4xl font-bold text-text-1 tracking-tight">Resilient Clinical Intelligence.</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp}
                className="card-interactive p-7 group">
                <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-5 group-hover:bg-gold group-hover:text-ink transition-all duration-200">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold text-text-1 mb-2">{title}</h3>
                <p className="text-text-3 text-sm leading-relaxed">{desc}</p>
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
    { icon: '🏥', title: 'National & Referral',   points: ['FHIR bundle export', 'Cross-tenant records', 'National bed queue'] },
    { icon: '🧪', title: 'District Hospitals',    points: ['Full OPD + pharmacy + lab', 'Works on 2G', 'Offline-capable'] },
    { icon: '👶', title: 'Maternity & Paediatrics', points: ['ANC schedule tracking', 'APGAR + PEWS scores', 'Immunisation records'] },
    { icon: '💊', title: 'Pharmacy & Inventory',  points: ['FEFO dispensing', 'Drug interaction alerts', 'Auto reorder triggers'] },
    { icon: '📱', title: 'Clinics & Health Centres', points: ['Set up in 24 hours', 'Grows with you', 'Patient SMS reminders'] },
    { icon: '🌍', title: 'Community Health',       points: ['CHW mobile app', 'Catchment mapping', 'MUAC screening'] },
  ];

  return (
    <section id="departments" className="bg-surface-1 py-24 px-6 border-y border-edge">
      <div className="max-w-7xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="label-sm text-text-3 mb-4">Departments</p>
            <h2 className="font-display text-4xl font-bold text-text-1 tracking-tight">Every department.<br />Every workflow.</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {depts.map(({ icon, title, points }) => (
              <motion.div key={title} variants={fadeUp}
                className="card p-7 hover:border-gold/30 hover:-translate-y-1 transition-all duration-200">
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="font-display font-semibold text-text-1 mb-3">{title}</h3>
                <ul className="space-y-2">
                  {points.map(p => (
                    <li key={p} className="text-sm text-text-3 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
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
    { num: 1,  title: 'No Poverty',        val: 68, color: '#E5243B' },
    { num: 3,  title: 'Good Health',        val: 94, color: '#4C9F38' },
    { num: 4,  title: 'Quality Education',  val: 55, color: '#C5192D' },
    { num: 5,  title: 'Gender Equality',    val: 71, color: '#FF3A21' },
    { num: 8,  title: 'Economic Growth',    val: 60, color: '#A21942' },
    { num: 10, title: 'Reduced Inequality', val: 78, color: '#DD1367' },
    { num: 13, title: 'Climate Action',     val: 42, color: '#3F7E44' },
    { num: 17, title: 'Partnerships',       val: 83, color: '#19486A' },
  ];

  return (
    <section id="impact" className="bg-ink py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="label-sm text-gold mb-4">SDG Impact</p>
            <h2 className="font-display text-4xl font-bold text-text-1 tracking-tight mb-4">
              Every encounter counts toward<br />the Sustainable Development Goals.
            </h2>
            <p className="text-text-3 max-w-xl mx-auto text-sm leading-relaxed">
              Every clinical action is automatically mapped to SDG indicators — giving hospitals, donors, and governments real-time health impact data.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {sdgs.map(({ num, title, val, color }) => (
              <motion.div key={num} variants={fadeUp}
                className="card p-5 text-center hover:border-edge-strong transition-colors">
                <div className="font-display text-2xl font-bold mb-1" style={{ color }}>{num}</div>
                <div className="text-[9px] font-bold text-text-3 uppercase tracking-wider mb-3">{title}</div>
                <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${val}%`, backgroundColor: color }} />
                </div>
                <div className="font-mono text-xs text-text-2 mt-2">{val}%</div>
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
    <section className="bg-surface-1 py-20 px-6 border-y border-edge">
      <div className="max-w-4xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp}
            className="relative rounded-3xl border border-gold/20 p-12 text-center overflow-hidden bg-surface-2">
            {/* Gold glow bg */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-gold/8 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/20 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inset-0 rounded-full bg-gold opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
                </span>
                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">Live Demo — Real Patient Data</span>
              </div>

              <h2 className="font-display text-3xl font-bold text-text-1 mb-4 tracking-tight">
                See Synapse OS with 11 real patients<br />from Mengo Hospital.
              </h2>
              <p className="text-text-3 mb-8 max-w-lg mx-auto text-sm leading-relaxed">
                Live data from our Supabase database — real triage statuses, real vitals, real UCG clinical guidelines. No mock data. No smoke and mirrors.
              </p>

              <div className="flex flex-wrap gap-4 justify-center">
                <Link to="/demo/doctor" className="btn-primary px-8 py-4 text-sm flex items-center gap-2 shadow-[0_8px_32px_rgba(232,184,75,0.2)]">
                  Open Doctor Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/demo" className="btn-outline px-8 py-4 text-sm">
                  Choose a Role
                </Link>
              </div>
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
    <section className="bg-ink py-20 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <FadeSection>
          <motion.div variants={fadeUp}>
            <div className="text-5xl text-gold/30 font-serif mb-6 leading-none">"</div>
            <p className="text-xl font-body font-medium text-text-2 leading-relaxed mb-8 italic">
              Synapse OS flagged a drug interaction I would have missed. The AI suggested checking blood glucose before I even thought to. This is what evidence-based medicine looks like in practice.
            </p>
            <div className="inline-flex flex-col items-center gap-1">
              <div className="w-px h-8 bg-gold/30 mb-3" />
              <p className="font-display font-bold text-text-1">Dr. Amina K.</p>
              <p className="text-xs text-text-3 uppercase tracking-widest font-bold">Internal Medicine · Mulago National Referral Hospital · Pilot Participant</p>
            </div>
          </motion.div>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────
function Team() {
  const team = [
    {
      name: 'Tushabe Ebrine',
      role: 'Co-Founder · CEO / CTO',
      bio: 'Lead engineer who built the core clinical AI engine. Focused on infrastructure resilience, offline-first architecture, and clinical safety for high-stakes medical environments across East Africa.',
      img: '/assets/team/ebrine-tushabe.jpg',
      linkedin: '#', github: '#', hasGithub: true,
    },
    {
      name: 'Nathan David',
      role: 'Co-Founder · COO',
      bio: 'Health financing analyst with regional expertise in hospital operations, insurance systems optimisation, and healthcare economics across East Africa. Drives go-to-market and partnerships.',
      img: '/assets/team/nathan-david.jpg',
      linkedin: '#', email: 'contact@synapseos.tech', hasGithub: false,
    },
  ];

  return (
    <section id="team" className="bg-surface-1 py-24 px-6 border-y border-edge">
      <div className="max-w-4xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="label-sm text-text-3 mb-4">The Architects</p>
            <h2 className="font-display text-4xl font-bold text-text-1 tracking-tight">
              Built by Africans,<br /><span className="text-text-3">for Africa.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {team.map(({ name, role, bio, img, linkedin, github, email, hasGithub }) => (
              <motion.div key={name} variants={fadeUp}
                className="card p-8 flex flex-col items-center text-center hover:border-gold/30 transition-all duration-200 group">
                <div className="w-28 h-28 rounded-2xl mb-6 border-2 border-edge group-hover:border-gold/40 transition-colors overflow-hidden bg-surface-3">
                  <img src={img} alt={name} className="w-full h-full object-cover object-top" />
                </div>
                <h3 className="font-display text-xl font-bold text-text-1 mb-1">{name}</h3>
                <p className="text-gold text-[10px] font-bold uppercase tracking-[0.2em] mb-5">{role}</p>
                <p className="text-text-3 leading-relaxed text-sm mb-7">{bio}</p>
                <div className="flex gap-2">
                  <a href={linkedin} aria-label={`${name} on LinkedIn`}
                    className="w-9 h-9 rounded-xl bg-surface-2 border border-edge flex items-center justify-center hover:border-gold/40 hover:text-gold transition-all text-text-3">
                    <Linkedin className="w-4 h-4" />
                  </a>
                  {hasGithub && (
                    <a href={github} aria-label={`${name} on GitHub`}
                      className="w-9 h-9 rounded-xl bg-surface-2 border border-edge flex items-center justify-center hover:border-gold/40 hover:text-gold transition-all text-text-3">
                      <Github className="w-4 h-4" />
                    </a>
                  )}
                  {!hasGithub && email && (
                    <a href={`mailto:${email}`} aria-label={`Email ${name}`}
                      className="w-9 h-9 rounded-xl bg-surface-2 border border-edge flex items-center justify-center hover:border-gold/40 hover:text-gold transition-all text-text-3">
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
      name: 'Professional', price: 'UGX 750K', sub: '/ month',
      features: ['Up to 200 beds', 'Unlimited staff', 'All clinical modules', 'Insurance Copilot', 'AI (2,000 calls/day)', 'FHIR API access', 'SDG dashboard'],
      cta: 'Apply Now', href: '/apply?plan=professional', highlight: true,
    },
    {
      name: 'Enterprise', price: 'Custom', sub: 'Unlimited everything',
      features: ['Unlimited beds & staff', 'Custom integrations', 'HMIS national bridge', 'Dedicated SLA', '24/7 support', 'On-premise option'],
      cta: 'Contact Us', href: '/contact', highlight: false,
    },
  ];

  return (
    <section id="pricing" className="bg-ink py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <FadeSection>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="label-sm text-gold mb-4">Pricing</p>
            <h2 className="font-display text-4xl font-bold text-text-1 tracking-tight">Priced for African healthcare.</h2>
            <p className="text-text-3 mt-3 text-sm">No hidden fees. No per-seat charges. Cancel any time.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5 items-start">
            {plans.map(({ name, price, sub, features, cta, href, highlight }) => (
              <motion.div key={name} variants={fadeUp}
                className={cn(
                  'rounded-2xl border p-8 relative transition-all',
                  highlight
                    ? 'bg-surface-2 border-gold shadow-[0_0_48px_rgba(232,184,75,0.12)] md:scale-105 z-10'
                    : 'card'
                )}>
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gold text-ink text-[9px] font-black uppercase tracking-[0.2em] rounded-full whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                <p className="label-xs text-gold mb-3">{name}</p>
                <div className="font-display text-4xl font-bold text-text-1 tracking-tight mb-1">{price}</div>
                <p className="text-xs text-text-3 mb-8">{sub}</p>
                <ul className="space-y-3 mb-10">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-text-2">
                      <CheckCircle className="w-3.5 h-3.5 text-gold shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to={href}
                  className={cn('block text-center w-full', highlight ? 'btn-primary' : 'btn-outline')}>
                  {cta}
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.p variants={fadeUp} className="text-center text-xs text-text-3 mt-8">
            All plans include offline mode · ICD-11 coding · UCG-grounded AI · Uganda DPPA 2019 compliance
          </motion.p>
        </FadeSection>
      </div>
    </section>
  );
}

// ─── Apply CTA ────────────────────────────────────────────────────────────────
function ApplyCTA() {
  return (
    <section className="bg-surface-1 py-20 px-6 border-t border-edge">
      <FadeSection className="max-w-4xl mx-auto">
        <motion.div variants={fadeUp}
          className="relative rounded-3xl border border-gold/25 p-16 text-center overflow-hidden">
          <div className="absolute inset-0 bg-surface-2 rounded-3xl" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-linear-to-r from-transparent via-gold/40 to-transparent" />
          <div className="relative">
            <Heart className="w-8 h-8 text-gold mx-auto mb-6 opacity-80" />
            <h2 className="font-display text-4xl font-bold text-text-1 mb-4 tracking-tight">
              Ready to bring AI to your facility?
            </h2>
            <p className="text-text-3 mb-8 max-w-md mx-auto text-sm leading-relaxed">
              Join our pilot programme. First 20 facilities get free onboarding support, data migration, and 90 days free.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/apply" className="btn-primary px-10 py-4 text-sm shadow-[0_8px_32px_rgba(232,184,75,0.2)]">
                Apply for Pilot Access
              </Link>
              <Link to="/contact" className="btn-ghost px-10 py-4 text-sm border border-edge hover:border-edge-strong">
                Talk to Us
              </Link>
            </div>
          </div>
        </motion.div>
      </FadeSection>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const footerLinks = [
    { heading: 'Platform', links: [['Features', '/features'], ['Live Demo', '/demo'], ['Pricing', '/pricing'], ['API Docs', '/docs']] },
    { heading: 'Company',  links: [['About', '/about'], ['Blog', '/blog'], ['Careers', '/careers'], ['Contact', '/contact']] },
    { heading: 'Legal',    links: [['Privacy', '/privacy'], ['Terms', '/terms'], ['DPA', '/dpa'], ['Consent', '/consent']] },
  ];

  return (
    <footer className="bg-ink border-t border-edge py-20 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
        <div className="col-span-2">
          <Link to="/" aria-label="SynapseOS home">
            <SynapseLogo variant="dark" />
          </Link>
          <p className="text-text-3 text-sm leading-relaxed max-w-xs my-6">
            The AI operating system for African healthcare. Closing the clinical intelligence gap — one hospital at a time.
          </p>
          <div className="flex gap-4">
            <span className="label-xs">Est. 2024</span>
            <span className="label-xs">Built in Kampala 🇺🇬</span>
          </div>
        </div>

        {footerLinks.map(({ heading, links }) => (
          <div key={heading}>
            <h4 className="label-xs text-text-1 mb-6">{heading}</h4>
            <ul className="space-y-3">
              {links.map(([label, href]) => (
                <li key={label}>
                  <Link to={href} className="text-sm text-text-3 hover:text-gold transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-edge flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-xs font-bold text-text-3 uppercase tracking-widest text-center md:text-left">
          © 2026 Synapse Health Technologies Ltd. · Kampala, Uganda.
        </p>
        <p className="text-xs text-text-3 tracking-wide text-center">
          Uganda DPPA 2019 · ISO 27001 Aligned · ICD-11 WHO Standard
        </p>
        <Link to="/status" className="flex items-center gap-2 text-xs font-bold text-text-3 hover:text-gold transition-colors uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
          Network Active
        </Link>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="font-body bg-ink">
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
