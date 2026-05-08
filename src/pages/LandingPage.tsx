import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CheckCircle,
  ChevronRight,
  Globe,
  Linkedin,
  Github,
  Mail,
  Shield,
  Microscope,
  Pill,
  Users,
  Smartphone,
  Zap,
  BarChart3,
  Database,
  Calendar,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Stethoscope,
  Heart,
  Baby,
  Dna,
  Thermometer,
  Eye,
  Crosshair,
  Timer
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState('doctor');

  return (
    <div className="min-h-screen bg-synapse-black text-white font-sans selection:bg-synapse-primary/30 selection:text-cyan-200 overflow-x-hidden">
      {/* SECTION 1: NAVIGATION */}
      <nav className="fixed top-0 w-full z-50 bg-synapse-black/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-12">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-synapse-primary rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5 text-synapse-black" />
            </div>
            <span className="font-black text-xl tracking-tighter text-white uppercase">Synapse<span className="text-synapse-primary">OS</span></span>
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            <Link to="/features" className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors uppercase tracking-[0.2em]">Features</Link>
            <a href="#departments" className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors uppercase tracking-[0.2em]">Departments</a>
            <Link to="/tele" className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors uppercase tracking-[0.2em]">Telemedicine</Link>
            <Link to="/scores" className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors uppercase tracking-[0.2em]">Scores</Link>
            <a href="#pricing" className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors uppercase tracking-[0.2em]">Pricing</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link to="/demo" className="hidden sm:block text-[10px] font-bold text-white uppercase tracking-[0.2em] px-6 py-2 border border-white/10 rounded-full hover:bg-white/5 transition-colors">View Demo</Link>
          <Link to="/apply" className="btn-primary py-2 px-6 text-[10px] uppercase tracking-[0.2em]">Apply for Access</Link>
        </div>
      </nav>

      {/* SECTION 2: HERO */}
      <header className="relative pt-40 pb-24 px-6 lg:px-12 overflow-hidden border-b border-white/5">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-synapse-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-synapse-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-synapse-primary">v2.0-stable live in kampala</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="heading-huge uppercase tracking-tighter mb-8 max-w-4xl"
          >
            Sovereign <span className="text-gradient">Clinical Intelligence</span> for Africa.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-neutral-400 font-medium max-w-2xl leading-relaxed mb-12"
          >
            The two-product ecosystem connecting hospital operations with community health through grounded AI and FHIR standards.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-6"
          >
            <Link to="/demo" className="btn-primary py-5 px-10 text-[11px] font-black flex items-center gap-4 group">
              LAUNCH INTERACTIVE DEMO <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/apply" className="text-[11px] font-black uppercase tracking-[0.3em] text-white hover:text-synapse-primary transition-colors py-5 px-10 border border-white/10 rounded-2xl hover:bg-white/5">
              Apply for Pilot Access
            </Link>
          </motion.div>

          {/* Live Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-12 w-full max-w-5xl"
          >
            {[
              { label: 'Active Patients', value: '42.8k+' },
              { label: 'Health Facilities', value: '14' },
              { label: 'AI Accuracy', value: '96.4%' },
              { label: 'Uptime', value: '99.9%' }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-black text-white mb-2 tracking-tighter">{stat.value}</p>
                <p className="text-mono-xs text-neutral-600">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </header>

      {/* SECTION 3: TRUST BADGES */}
      <section className="py-12 border-b border-white/5 bg-synapse-dark/30 overflow-x-auto whitespace-nowrap scrollbar-hide px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-12">
          {[
            { icon: Shield, label: 'Uganda DPPA 2019', path: '/legal/privacy' },
            { icon: Globe, label: 'Works Offline', path: '/features#offline' },
            { icon: Activity, label: 'AI Concordance', path: '/about' },
            { icon: Microscope, label: 'ICD-11 STANDARDS', path: '/features#ai-workspace' },
            { icon: Database, label: 'End-to-End Encrypted', path: '/legal/dpa' },
            { icon: Zap, label: 'STI-OP FUNDED', path: '/about#funding' }
          ].map((badge, i) => (
            <Link key={i} to={badge.path} className="flex items-center gap-3 group">
              <badge.icon className="w-5 h-5 text-neutral-600 group-hover:text-synapse-primary transition-colors" />
              <span className="text-mono-xs text-neutral-500 group-hover:text-white transition-colors">{badge.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION 4: AI WORKSPACE FEATURE */}
      <section id="ai-workspace" className="py-32 px-6 lg:px-12 border-b border-white/5">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="text-mono-xs text-synapse-primary mb-6">Clinical Intelligence</h2>
            <p className="heading-huge uppercase mb-8">AI Workspace <span className="text-neutral-500">at the Bedside.</span></p>
            <p className="text-lg text-neutral-400 font-medium mb-12 leading-relaxed">
              Every clinical encounter is augmented by MedGemma 27B, grounded in the latest Uganda Clinical Guidelines through RAG architecture.
            </p>

            <ul className="space-y-6 mb-12">
              {[
                'Differential diagnosis with confidence scoring',
                'ICD-11 coded recommendations',
                'Drug interaction checking on every order',
                'Automated SOAP note and discharge generation'
              ].map((item, i) => (
                <li key={i} className="flex gap-4 items-start">
                  <CheckCircle className="w-5 h-5 text-synapse-primary shrink-0" />
                  <span className="text-sm font-bold text-neutral-300 uppercase tracking-tight">{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex gap-6">
              <Link to="/demo/doctor" className="btn-primary py-4 px-8 text-[10px]">SEE FULL DEMO</Link>
              <a href="/admin/settings/guidelines" className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2 hover:text-synapse-primary transition-colors">
                UGANDA CLINICAL GUIDELINES 2023 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-4 bg-synapse-primary/10 rounded-[2.5rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative card p-8 border-synapse-primary/30 shadow-2xl shadow-cyan-500/10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <BrainCircuit className="w-5 h-5 text-synapse-primary" />
                  <span className="text-mono-xs">DIAGNOSIS ASSISTANT</span>
                </div>
                <div className="badge-primary">REAL-TIME</div>
              </div>
              <div className="space-y-6">
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">Primary Differential</p>
                  <div className="flex justify-between items-center">
                    <p className="font-black text-white uppercase tracking-tight text-lg">Severe Malaria</p>
                    <span className="text-synapse-primary font-black">94% CONFIDENCE</span>
                  </div>
                </div>
                <div className="p-5 bg-synapse-primary/10 border border-synapse-primary/20 rounded-2xl">
                  <p className="text-[10px] text-synapse-primary uppercase tracking-widest mb-2 font-black">Protocol Recommendation</p>
                  <p className="text-sm font-bold leading-relaxed text-neutral-200">
                    Initiate IV Artesunate 2.4mg/kg loading dose immediately as per UCG Section 5.1.1.
                  </p>
                </div>
                <button className="w-full btn-primary py-4 text-[10px] group">
                  RUN AI DIAGNOSIS <Activity className="w-4 h-4 ml-2 inline-block group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: TELEMEDICINE PREVIEW */}
      <section id="telemedicine" className="py-32 px-6 lg:px-12 bg-synapse-dark/30 border-b border-white/5">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1 relative">
             <div className="flex justify-center">
                <div className="w-[300px] h-[600px] bg-synapse-black border-[8px] border-neutral-800 rounded-[3rem] shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 w-full h-8 bg-neutral-800 flex justify-center items-end pb-1">
                      <div className="w-16 h-4 bg-synapse-black rounded-full" />
                   </div>
                   <div className="p-8 pt-12 space-y-8">
                      <div className="flex items-center justify-between">
                         <div className="w-10 h-10 bg-white/5 rounded-full" />
                         <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5 text-synapse-primary" /></div>
                      </div>
                      <div className="space-y-4">
                         <h3 className="text-2xl font-black uppercase tracking-tight">Consult <br /> <span className="text-synapse-primary">Dr. Namata</span></h3>
                         <div className="flex items-center gap-2 text-mono-xs text-neutral-600">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" /> AVAILABLE NOW
                         </div>
                      </div>
                      <div className="space-y-3">
                         <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase">Voice Consultation</span>
                            <ChevronRight className="w-4 h-4 text-neutral-700" />
                         </div>
                         <div className="p-4 bg-synapse-primary text-synapse-black rounded-2xl flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase">Video Consultation</span>
                            <ChevronRight className="w-4 h-4" />
                         </div>
                      </div>
                   </div>
                   <div className="absolute bottom-0 w-full p-8 flex justify-center">
                      <div className="w-32 h-1 bg-white/10 rounded-full" />
                   </div>
                </div>
             </div>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-mono-xs text-synapse-primary mb-6">Patient-Centric Care</h2>
            <p className="heading-huge uppercase mb-8">Integrated <br /> <span className="text-neutral-500">Telemedicine.</span></p>
            <p className="text-lg text-neutral-400 font-medium mb-12 leading-relaxed">
              Bridge the gap between home and hospital. High-definition video consultations with real-time clinical note generation.
            </p>
            <Link to="/tele" className="btn-primary py-5 px-10 text-[11px] font-black inline-flex items-center gap-4">
              TRY TELEMEDICINE DEMO <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 6: CLINICAL SCORING PREVIEW */}
      <section className="py-32 px-6 lg:px-12 border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-mono-xs text-synapse-primary mb-6">Precision Measurement</h2>
            <p className="heading-huge uppercase">150+ Clinical <span className="text-neutral-500">Scoring Hub.</span></p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {[
              { code: 'GCS', title: 'Glasgow Coma Scale', category: 'Emergency' },
              { code: 'SOFA', title: 'Sequential Organ Failure', category: 'ICU' },
              { code: 'PHQ-9', title: 'Patient Health Questionnaire', category: 'Mental Health' },
              { code: 'CURB-65', title: 'Pneumonia Severity Score', category: 'Medicine' },
              { code: 'APGAR', title: 'Newborn Assessment', category: 'Obstetrics' },
              { code: 'TIMI', title: 'Risk for STEMI', category: 'Cardiology' }
            ].map((score, i) => (
              <Link key={i} to={`/scores/${score.code.toLowerCase()}`} className="group">
                <div className="card p-8 border-white/5 hover:border-synapse-primary/30 transition-all group-hover:-translate-y-2">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-mono-xs text-neutral-600">{score.category}</span>
                    <Activity className="w-4 h-4 text-neutral-700 group-hover:text-synapse-primary transition-colors" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">{score.code}</h3>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">{score.title}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link to="/scores" className="btn-primary py-4 px-8 text-[10px]">VIEW ALL 150+ SCORES</Link>
            <Link to="/scores" className="text-[10px] font-black uppercase tracking-widest text-white py-4 px-8 border border-white/10 rounded-2xl hover:bg-white/5 transition-colors">
              Try Score Calculator
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 7: DEPARTMENT GRID */}
      <section id="departments" className="py-32 px-6 lg:px-12 bg-synapse-dark/30 border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-mono-xs text-synapse-primary mb-6">Total Facility Coverage</h2>
            <p className="heading-huge uppercase">Specialized <span className="text-neutral-500">Modules.</span></p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
             {[
               { icon: Activity, label: 'OPD', path: '#opd' },
               { icon: Stethoscope, label: 'Emergency', path: '#telemedicine' },
               { icon: Baby, label: 'Maternity', path: '#maternity' },
               { icon: Pill, label: 'Pharmacy', path: '#pharmacy' },
               { icon: Microscope, label: 'Laboratory', path: '#lab' },
               { icon: Heart, label: 'Cardiology', path: '#cardiology' },
               { icon: Dna, label: 'HIV Clinic', path: '#hiv' },
               { icon: BrainCircuit, label: 'Neurology', path: '#neurology' },
               { icon: Users, label: 'Community', path: '#offline' },
               { icon: Globe, label: 'SDG Center', path: '#sdg' },
               { icon: ShieldCheck, label: 'Insurance', path: '#insurance' },
               { icon: Calendar, label: 'Appointments', path: '#telemedicine' },
               { icon: Thermometer, label: 'ICU', path: '#icu' },
               { icon: Microscope, label: 'Pathology', path: '#departments' },
               { icon: Crosshair, label: 'Oncology', path: '#oncology' },
               { icon: Eye, label: 'Ophthalmology', path: '#departments' },
               { icon: Stethoscope, label: 'Radiology', path: '#radiology' },
               { icon: Activity, label: 'Surgery', path: '#theatre' },
               { icon: Users, label: 'Palliative', path: '#carepath' },
               { icon: Activity, label: 'Physiotherapy', path: '#departments' },
               { icon: Pill, label: 'Nutrition', path: '#paediatrics' },
               { icon: Shield, label: 'Security', path: '#audit' },
               { icon: Smartphone, label: 'VHT/CHW', path: '#community' },
               { icon: Activity, label: 'Billing', path: '#finance' }
             ].map((dept, i) => (
               <a key={i} href={`/features${dept.path}`} className="group">
                  <div className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/5 rounded-2xl hover:border-synapse-primary/30 transition-all hover:bg-synapse-primary/5">
                     <dept.icon className="w-6 h-6 text-neutral-500 group-hover:text-synapse-primary mb-4 transition-colors" />
                     <span className="text-[10px] font-black text-neutral-400 group-hover:text-white uppercase tracking-tighter">{dept.label}</span>
                  </div>
               </a>
             ))}
          </div>
        </div>
      </section>

      {/* SECTION 8: ECOSYSTEM DIAGRAM */}
      <section className="py-32 px-6 lg:px-12 border-b border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-mono-xs text-synapse-primary mb-6">Connected Care</h2>
          <p className="heading-huge uppercase mb-20">The Synapse <span className="text-neutral-500">Ecosystem.</span></p>

          <div className="relative max-w-4xl mx-auto py-20">
             {/* Ecosystem Viz - CSS based diagram */}
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[600px] h-[600px] border-2 border-dashed border-white/5 rounded-full animate-[spin_60s_linear_infinite]" />
                <div className="absolute w-[400px] h-[400px] border-2 border-dashed border-white/5 rounded-full animate-[spin_40s_linear_infinite_reverse]" />
             </div>

             <div className="relative grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
                <div className="space-y-6">
                   <div className="card p-8 group hover:border-synapse-primary/30 transition-all">
                      <Smartphone className="w-8 h-8 text-synapse-primary mb-4 mx-auto" />
                      <p className="text-sm font-black uppercase tracking-tight mb-2">Synapse App</p>
                      <p className="text-mono-xs text-neutral-600">Patient & Community</p>
                   </div>
                   <div className="h-px bg-gradient-to-r from-transparent via-synapse-primary/30 to-transparent w-full" />
                   <p className="text-mono-xs text-neutral-700">Real-time FHIR Sync</p>
                </div>

                <div className="flex flex-col items-center">
                   <div className="w-40 h-40 bg-synapse-primary rounded-[2.5rem] flex items-center justify-center shadow-[0_0_80px_rgba(6,182,212,0.3)] z-10">
                      <Activity className="w-20 h-20 text-synapse-black" />
                   </div>
                   <p className="text-[10px] font-black text-synapse-primary mt-8 uppercase tracking-[0.4em]">Synapse Core</p>
                </div>

                <div className="space-y-6">
                   <div className="card p-8 group hover:border-emerald-500/30 transition-all">
                      <Activity className="w-8 h-8 text-emerald-500 mb-4 mx-auto" />
                      <p className="text-sm font-black uppercase tracking-tight mb-2">Synapse OS</p>
                      <p className="text-mono-xs text-neutral-600">Facility Platform</p>
                   </div>
                   <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent w-full" />
                   <p className="text-mono-xs text-neutral-700">Multi-tenant Cloud</p>
                </div>
             </div>

             <div className="mt-20 flex flex-col sm:flex-row justify-center gap-12">
                <Link to="/features" className="text-mono-xs text-synapse-primary hover:text-white transition-colors uppercase tracking-widest">Learn about Synapse OS →</Link>
                <Link to="/apply" className="text-mono-xs text-synapse-primary hover:text-white transition-colors uppercase tracking-widest">Download the App →</Link>
             </div>
          </div>
        </div>
      </section>

      {/* SECTION 9: SDG WHEEL */}
      <section id="sdg" className="py-32 px-6 lg:px-12 bg-synapse-dark/30 border-b border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <h2 className="text-mono-xs text-synapse-primary mb-6">Global Impact</h2>
            <p className="heading-huge uppercase mb-8">SDG Command <span className="text-neutral-500">Center.</span></p>
            <p className="text-lg text-neutral-400 font-medium mb-12 leading-relaxed">
              Real-time tracking of Sustainable Development Goals. Clinical data automatically aggregated to measure national and global health progress.
            </p>
            <div className="space-y-8">
               <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-synapse-primary/10 rounded-xl flex items-center justify-center font-black text-synapse-primary">03</div>
                  <div>
                     <p className="text-sm font-black uppercase tracking-tight text-white">Good Health & Well-being</p>
                     <p className="text-mono-xs text-neutral-600">Maternal mortality and infectious disease tracking</p>
                  </div>
               </div>
               <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-synapse-primary/10 rounded-xl flex items-center justify-center font-black text-synapse-primary">17</div>
                  <div>
                     <p className="text-sm font-black uppercase tracking-tight text-white">Partnerships for the Goals</p>
                     <p className="text-mono-xs text-neutral-600">Cross-facility interoperability and national scaling</p>
                  </div>
               </div>
            </div>
            <div className="mt-12">
               <Link to="/sdg" className="btn-primary py-4 px-8 text-[10px]">VIEW SDG DASHBOARD</Link>
            </div>
          </div>

          <div className="relative">
             {/* Visual placeholder for the SDG wheel */}
             <div className="aspect-square rounded-full border-2 border-white/5 flex items-center justify-center p-12">
                <div className="w-full h-full rounded-full border-2 border-synapse-primary/20 flex items-center justify-center relative">
                   {[...Array(17)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-12 h-12 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center font-black text-[10px] text-neutral-600 hover:bg-synapse-primary hover:text-synapse-black hover:scale-110 transition-all cursor-pointer"
                        style={{
                           transform: `rotate(${(360 / 17) * i}deg) translateY(-140px) rotate(-${(360 / 17) * i}deg)`
                        }}
                      >
                         {i + 1}
                      </div>
                   ))}
                   <div className="text-center">
                      <p className="text-4xl font-black text-white tracking-tighter">92%</p>
                      <p className="text-mono-xs text-synapse-primary">OVERALL GOAL</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* SECTION 10: DEMO PREVIEW (PATIENT QUEUE) */}
      <section className="py-32 px-6 lg:px-12 border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-mono-xs text-synapse-primary mb-6">Experience the Workflow</h2>
            <p className="heading-huge uppercase">Interactive <span className="text-neutral-500">Live Demo.</span></p>
          </div>

          <div className="card p-8 border-white/10 bg-white/5 mb-16 overflow-hidden">
             <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-6">
                <div className="flex items-center gap-6">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-synapse-primary" />
                      <span className="text-mono-xs text-white">OPD QUEUE</span>
                   </div>
                   <div className="text-mono-xs text-neutral-700">12 PATIENTS WAITING</div>
                </div>
                <div className="flex gap-4">
                   <div className="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-black text-neutral-600 tracking-widest uppercase">FILTER: ACUITY</div>
                </div>
             </div>

             <div className="space-y-4">
                {[
                  { name: 'Kato Samuel', id: 'MUL-2024-0891', triage: 'IMMEDIATE', wait: '4m', status: 'critical' },
                  { name: 'Nakato Mary', id: 'MUL-2024-1204', triage: 'URGENT', wait: '12m', status: 'warning' },
                  { name: 'Ssekamate John', id: 'MUL-2024-0552', triage: 'ROUTINE', wait: '45m', status: 'normal' }
                ].map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-6 bg-synapse-black border border-white/5 rounded-2xl group hover:border-synapse-primary/30 transition-all">
                     <div className="flex items-center gap-8">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-xs font-black text-neutral-500">
                           {p.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                           <p className="text-sm font-black text-white uppercase tracking-tight">{p.name}</p>
                           <p className="text-mono-xs text-neutral-600">{p.id}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-12">
                        <div className="text-right">
                           <p className={cn(
                              "text-[9px] font-black uppercase tracking-widest mb-1",
                              p.status === 'critical' ? 'text-red-500' : p.status === 'warning' ? 'text-amber-500' : 'text-emerald-500'
                           )}>{p.triage}</p>
                           <p className="text-mono-xs text-neutral-700">WAIT: {p.wait}</p>
                        </div>
                        <Link to="/demo/doctor" className="btn-secondary py-2 px-6 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity">OPEN →</Link>
                     </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link to="/demo" className="btn-primary py-4 px-10 text-[10px]">LAUNCH FULL DEMO</Link>
            <Link to="/apply" className="text-[10px] font-black uppercase tracking-widest text-white py-4 px-10 border border-white/10 rounded-2xl hover:bg-white/5 transition-colors">
              Apply for Access
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 11: ABOUT THE TEAM */}
      <section id="about" className="py-32 px-6 lg:px-12 bg-synapse-dark/50 border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-mono-xs text-synapse-primary mb-6">The Architects</h2>
            <p className="heading-huge uppercase">Built by Africans, <span className="text-neutral-500">for Africa.</span></p>
          </div>

          <div className="grid md:grid-cols-2 gap-16 max-w-5xl mx-auto">
            <motion.div whileHover={{ y: -8 }} className="card p-10 flex flex-col items-center text-center group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                 <Activity className="w-24 h-24 text-synapse-primary" />
              </div>
              <div className="w-32 h-32 rounded-full mb-8 border-4 border-white/5 shadow-2xl overflow-hidden bg-gradient-to-br from-synapse-primary to-blue-700 flex items-center justify-center text-white text-4xl font-black group-hover:scale-105 transition-transform relative z-10">
                JT
              </div>
              <h3 className="text-2xl font-black mb-2 text-white uppercase tracking-tight">Jason Ebrine Tushabe</h3>
              <p className="text-mono-xs text-synapse-primary mb-8 font-black tracking-widest">CO-FOUNDER & CEO / CTO</p>
              <p className="text-neutral-400 text-sm font-medium leading-relaxed mb-10">
                Health informatician and self-taught software engineer. Built Habakkuk, a pharmacy system deployed across Uganda. Architected the entire Synapse ecosystem using Claude Code.
              </p>
              <div className="flex gap-6 mt-auto">
                <a href="https://www.linkedin.com/in/ebrine-tushabe-5512263ba/" className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-synapse-primary hover:text-synapse-black transition-all text-neutral-400">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="mailto:founder@synapseos.tech" className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-synapse-primary hover:text-synapse-black transition-all text-neutral-400">
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </motion.div>
            
            <motion.div whileHover={{ y: -8 }} className="card p-10 flex flex-col items-center text-center group relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                 <ShieldCheck className="w-24 h-24 text-emerald-500" />
              </div>
              <div className="w-32 h-32 rounded-full mb-8 border-4 border-white/5 shadow-2xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-4xl font-black group-hover:scale-105 transition-transform relative z-10">
                ND
              </div>
              <h3 className="text-2xl font-black mb-2 text-white uppercase tracking-tight">Nathan David</h3>
              <p className="text-mono-xs text-synapse-primary mb-8 font-black tracking-widest">CO-FOUNDER & COO</p>
              <p className="text-neutral-400 text-sm font-medium leading-relaxed mb-10">
                Six years in healthcare financing and insurance in Uganda. Deep expertise in hospital revenue cycles and insurance system optimization. Leads partnerships and regulatory engagement.
              </p>
              <div className="flex gap-6 mt-auto">
                <a href="#" className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-emerald-500 hover:text-synapse-black transition-all text-neutral-400">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="mailto:nathandavid762@gmail.com" className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-emerald-500 hover:text-synapse-black transition-all text-neutral-400">
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </motion.div>
          </div>

          <div className="mt-24 text-center">
            <Link to="/about" className="text-mono-xs text-neutral-600 hover:text-white transition-colors uppercase tracking-[0.3em]">Read our story →</Link>
          </div>
        </div>
      </section>

      {/* SECTION 12: FOR PROFESSIONALS */}
      <section className="py-32 px-6 lg:px-12 bg-synapse-primary text-synapse-black overflow-hidden relative">
         <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-[100px] pointer-events-none" />
         <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-16 relative z-10">
            <div className="max-w-2xl">
               <h2 className="text-mono-xs text-synapse-black/60 mb-6 font-black uppercase tracking-[0.4em]">PROFESSIONAL NETWORK</h2>
               <p className="heading-huge uppercase mb-8">Empowering the <br /> <span className="text-synapse-black/40">Clinical Frontline.</span></p>
               <p className="text-xl font-bold leading-relaxed text-synapse-black/70 mb-12">
                  Are you an independent doctor or clinical specialist? Join our professional network to provide virtual care and specialist consultations across the Synapse ecosystem.
               </p>
               <div className="flex gap-6">
                  <Link to="/apply-professional" className="bg-synapse-black text-white py-5 px-10 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-neutral-900 transition-colors">Apply as a Doctor</Link>
                  <Link to="/features#telemedicine" className="py-5 px-10 rounded-2xl font-black text-[11px] uppercase tracking-widest border border-synapse-black/20 hover:bg-black/5 transition-colors">Learn More</Link>
               </div>
            </div>
            <div className="bg-white/10 p-12 rounded-[3rem] border border-white/20 backdrop-blur-sm">
               <Activity className="w-40 h-40 opacity-20" />
            </div>
         </div>
      </section>

      {/* SECTION 13: PRICING */}
      <section id="pricing" className="py-40 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-mono-xs text-synapse-primary mb-6">Sustainable Scaling</h2>
          <p className="heading-huge uppercase">Pricing <span className="text-neutral-500">Tiers.</span></p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
           {[
             { name: 'Pilot/Trial', price: 'Free', period: '30 Days', features: ['Full Department Access', 'AI Workspace (Limited)', 'Patient App Link', 'Basic Support'], cta: 'Request Pilot', plan: 'trial' },
             { name: 'Starter', price: '9', period: 'per facility/mo', features: ['Up to 3 Departments', 'Patient Registry', 'Basic Pharmacy', 'Email Support'], cta: 'Get Started', plan: 'starter' },
             { name: 'Professional', price: '9', period: 'per facility/mo', features: ['Unlimited Departments', 'Clinical AI Workspace', 'Insurance Copilot', 'Priority Support'], cta: 'Start Trial', highlight: true, plan: 'professional' },
             { name: 'Enterprise', price: 'Custom', period: 'Annual contract', features: ['Custom HL7/FHIR Bridging', 'Audit & Compliance Tools', 'On-Premise Fallback', '24/7 Dedicated Support'], cta: 'Contact Sales', plan: 'contact' }
           ].map((plan, i) => (
             <div key={i} className={cn(
               "p-10 rounded-3xl border transition-all relative overflow-hidden flex flex-col h-full",
               plan.highlight 
                ? "bg-white text-synapse-black border-synapse-primary shadow-2xl shadow-cyan-500/20 scale-105 z-10"
                : "bg-synapse-dark border-white/5"
             )}>
                {plan.highlight && <div className="absolute top-0 right-0 p-4 text-mono-xs text-synapse-primary bg-synapse-primary/10 rounded-bl-xl font-black">MOST POPULAR</div>}
                <div className={cn("text-mono-xs mb-6 uppercase tracking-widest", plan.highlight ? 'text-synapse-primary' : 'text-neutral-600')}>{plan.name}</div>
                <div className="mb-10">
                   <span className="text-5xl font-black tracking-tight">{plan.price}</span>
                   {plan.period && <span className="text-[10px] uppercase font-black text-neutral-500 ml-2">{plan.period}</span>}
                </div>
                <ul className="space-y-4 mb-12 flex-1">
                   {plan.features.map((f, j) => (
                     <li key={j} className="flex gap-3 items-start text-[10px] font-black uppercase tracking-tight opacity-80">
                       <CheckCircle className={cn("w-4 h-4 shrink-0", plan.highlight ? "text-synapse-primary" : "text-synapse-primary")} />
                       {f}
                     </li>
                   ))}
                </ul>
                <Link to={plan.plan === 'contact' ? '/contact' : `/apply?plan=${plan.plan}`} className={cn(
                  "w-full py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] block text-center transition-all",
                  plan.highlight ? "bg-synapse-black text-white hover:bg-neutral-900 shadow-xl" : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                )}>
                  {plan.cta}
                </Link>
             </div>
           ))}
        </div>
        <div className="mt-16 text-center">
           <Link to="/features" className="text-mono-xs text-neutral-700 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-2 justify-center">
              All plans include core infrastructure <ArrowRight className="w-3 h-3" />
           </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-synapse-black border-t border-white/5 py-40 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-16 mb-32">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-synapse-primary rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                 <Activity className="w-5 h-5 text-synapse-black" />
              </div>
              <span className="font-black text-xl tracking-tighter text-white uppercase">Synapse<span className="text-synapse-primary">OS</span></span>
            </div>
            <p className="text-neutral-500 font-medium max-w-sm leading-relaxed mb-10 text-sm">
              Sovereign health operating system for Africa. Connecting clinical intelligence to every life.
            </p>
            <div className="flex flex-col gap-3 text-mono-xs text-neutral-700">
               <span className="flex items-center gap-2">🇺🇬 BUILT IN UGANDA</span>
               <span className="flex items-center gap-2">© SYNAPSE HEALTH TECHNOLOGIES LTD</span>
            </div>
          </div>

          <div>
            <h4 className="text-mono-xs mb-10 text-white uppercase tracking-widest">Product</h4>
            <ul className="space-y-6 text-[10px] font-black text-neutral-600 uppercase tracking-widest">
              <li><Link to="/features" className="hover:text-synapse-primary transition-colors">Features</Link></li>
              <li><Link to="/demo" className="hover:text-synapse-primary transition-colors">OS Demo</Link></li>
              <li><a href="#pricing" className="hover:text-synapse-primary transition-colors">Pricing</a></li>
              <li><Link to="/docs" className="hover:text-synapse-primary transition-colors">Documentation</Link></li>
              <li><Link to="/changelog" className="hover:text-synapse-primary transition-colors">Changelog</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-mono-xs mb-10 text-white uppercase tracking-widest">Company</h4>
            <ul className="space-y-6 text-[10px] font-black text-neutral-600 uppercase tracking-widest">
              <li><Link to="/about" className="hover:text-synapse-primary transition-colors">About</Link></li>
              <li><Link to="/blog" className="hover:text-synapse-primary transition-colors">Blog</Link></li>
              <li><Link to="/careers" className="hover:text-synapse-primary transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="hover:text-synapse-primary transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-mono-xs mb-10 text-white uppercase tracking-widest">Legal</h4>
            <ul className="space-y-6 text-[10px] font-black text-neutral-600 uppercase tracking-widest">
              <li><Link to="/legal/privacy" className="hover:text-synapse-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/legal/terms" className="hover:text-synapse-primary transition-colors">Terms of Service</Link></li>
              <li><Link to="/legal/dpa" className="hover:text-synapse-primary transition-colors">Data Processing</Link></li>
              <li><Link to="/legal/accessibility" className="hover:text-synapse-primary transition-colors">Accessibility</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-12">
           <div className="flex flex-wrap justify-center md:justify-start gap-10 text-[10px] font-black text-neutral-700 uppercase tracking-widest">
              <span>Uganda DPPA 2019 Compliant</span>
              <span>ICD-11 WHO Standard</span>
              <span>ISO 27001 Aligned</span>
           </div>
           <div className="flex gap-10">
              <Link to="/status" className="flex items-center gap-2 text-[10px] font-bold text-neutral-700 hover:text-synapse-primary transition-colors uppercase tracking-widest group">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:animate-ping" /> System Status
              </Link>
           </div>
        </div>
      </footer>
    </div>
  );
}
