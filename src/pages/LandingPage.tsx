import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  ArrowRight,
  CheckCircle,
  ShieldCheck,
  Globe,
  Zap,
  Database,
  Cpu,
  Layout,
  Users,
  Smartphone,
  ChevronRight,
  Linkedin,
  Mail,
  X,
  Stethoscope,
  HeartPulse,
  Microscope,
  Pill,
  PieChart,
  Shield,
  Clock,
  Video,
  MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { ThemeToggle } from '../components/ThemeToggle';
import { Logo } from '../components/Logo';
import { MobileNav } from '../components/MobileNav';

const PricingModal = ({ isOpen, onClose, selectedPlan }: { isOpen: boolean, onClose: () => void, selectedPlan: string }) => {
  if (!isOpen) return null;

  const plans = {
    trial: { name: 'Pilot/Trial', price: 'Free', features: ['Full Department Access', 'AI Workspace (Limited)', 'Patient App Link', 'Basic Support', 'Sovereign Cloud Deployment'] },
    starter: { name: 'Starter', price: '99', features: ['Up to 3 Departments', 'Patient Registry', 'Basic Pharmacy', 'Email Support', '99.9% Uptime SLA'] },
    professional: { name: 'Professional', price: '499', features: ['Unlimited Departments', 'Clinical AI Workspace', 'Insurance Copilot', 'Priority Support', 'Full FHIR API Access'] },
    contact: { name: 'Enterprise', price: 'Custom', features: ['Custom HL7/FHIR Bridging', 'Audit & Compliance Tools', 'On-Premise Fallback', '24/7 Dedicated Support', 'White-label Patient Portal'] }
  };

  const plan = (plans as any)[selectedPlan] || plans.trial;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 bg-synapse-black/95 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="card w-full max-w-lg p-6 sm:p-10 relative overflow-hidden break-words shadow-2xl shadow-cyan-500/10 border-white/10"
      >
        <div className="absolute top-0 right-0 p-6">
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <X className="w-6 h-6 text-neutral-500" />
          </button>
        </div>

        <div className="text-mono-xs text-synapse-primary mb-2 uppercase tracking-[0.3em]">Plan Detail</div>
        <h2 className="text-3xl sm:text-4xl font-black uppercase mb-8 tracking-tighter">{plan.name}</h2>

        <div className="mb-10 p-6 bg-white/5 rounded-2xl border border-white/5">
           <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">Price Estimate</div>
           <div className="text-4xl font-black flex items-baseline gap-2">
             {!isNaN(Number(plan.price)) && <span className="text-4xl font-black text-white">$</span>}
             {plan.price}
             {plan.price !== 'Free' && plan.price !== 'Custom' && <span className="text-xs text-neutral-500 font-bold ml-1 uppercase tracking-widest">/month</span>}
           </div>
        </div>

        <ul className="space-y-4 mb-12">
          {plan.features.map((f: string, i: number) => (
            <li key={i} className="flex items-start gap-3 text-[11px] font-black uppercase tracking-tight text-neutral-400">
              <CheckCircle className="w-4 h-4 text-synapse-primary shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        <Link
          to={selectedPlan === 'contact' ? '/contact' : `/apply?plan=${selectedPlan}`}
          className="btn-primary w-full py-5 text-center block text-[11px]"
        >
          {selectedPlan === 'contact' ? 'Contact Sales Team' : 'Proceed with Application'}
        </Link>
      </motion.div>
    </motion.div>
  );
};

export default function LandingPage() {
  const [selectedPlan, setSelectedPlan] = useState('trial');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openPlan = (plan: string) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-synapse-black text-[var(--text-primary)] selection:bg-synapse-primary/30 selection:text-cyan-200 overflow-x-hidden">
      <AnimatePresence>
        {isModalOpen && <PricingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} selectedPlan={selectedPlan} />}
      </AnimatePresence>

      {/* SECTION 1: NAVIGATION */}
      <nav className="fixed top-0 w-full z-50 bg-synapse-black/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between px-4 lg:px-12">
        <Logo size="sm" />

        <div className="hidden lg:flex items-center gap-10 text-mono-xs text-neutral-500">
          <Link to="/features" className="hover:text-white transition-colors uppercase">Features</Link>
          <a href="#departments" className="hover:text-white transition-colors uppercase">Departments</a>
          <Link to="/demo" className="hover:text-white transition-colors uppercase">Demo</Link>
          <Link to="/tele" className="hover:text-white transition-colors uppercase">Telemedicine</Link>
          <a href="#pricing" className="hover:text-white transition-colors uppercase">Pricing</a>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/login" className="text-mono-xs text-[var(--text-primary)] hover:text-synapse-primary transition-colors hidden sm:block">Sign In</Link>
          <Link to="/apply" className="btn-primary py-2.5 px-6 text-[10px] hidden sm:block">Get Started</Link>
          <MobileNav />
        </div>
      </nav>

      {/* SECTION 2: HERO */}
      <section className="relative pt-32 pb-20 px-4 lg:pt-48 lg:pb-40 lg:px-12 overflow-hidden border-b border-white/5">
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block px-4 py-1.5 rounded-full bg-synapse-primary/10 border border-synapse-primary/20 text-[10px] font-black text-synapse-primary uppercase tracking-[0.2em] sm:tracking-[0.4em] mb-12"
          >
            Sovereign Health Infrastructure
          </motion.div>
          <h1 className="heading-huge mb-12 uppercase">Connecting <br /> <span className="text-neutral-500">Intelligence</span> <br /> to every life.</h1>
          <p className="text-xl lg:text-2xl font-bold max-w-3xl mx-auto text-neutral-400 mb-16 leading-relaxed">
            The first AI-native health operating system built in Uganda for the clinical frontline. One ecosystem, two products, infinite scale.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
             <Link to="/demo" className="btn-primary py-5 px-10 rounded-2xl w-full sm:w-auto">Launch Interactive Demo</Link>
             <Link to="/tele" className="btn-secondary py-5 px-10 rounded-2xl w-full sm:w-auto border-white/10 flex items-center justify-center gap-3 hover:bg-white/10">Try Telemedicine <Video className="w-4 h-4" /></Link>
          </div>

          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto opacity-40">
             <div>
                <div className="text-2xl font-black text-white">12</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Active Pilots</div>
             </div>
             <div>
                <div className="text-2xl font-black text-white">40k+</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Patient Records</div>
             </div>
             <div>
                <div className="text-2xl font-black text-white">99.9%</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Uptime</div>
             </div>
             <div>
                <div className="text-2xl font-black text-white">0s</div>
                <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Data Loss</div>
             </div>
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] bg-synapse-primary/5 rounded-full blur-[120px] -z-10" />
      </section>

      {/* SECTION 3: TRUST BADGES */}
      <section className="py-12 px-4 bg-synapse-dark/30 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:opacity-80 transition-opacity">
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><ShieldCheck className="w-4 h-4" /> Uganda DPPA 2019</div>
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Zap className="w-4 h-4" /> Works Offline</div>
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Cpu className="w-4 h-4" /> Gemini 2.0 Native</div>
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Database className="w-4 h-4" /> FHIR R4 Compliant</div>
        </div>
      </section>

      {/* SECTION 4: AI WORKSPACE FEATURE */}
      <section className="py-24 lg:py-40 px-3 sm:px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <div className="text-mono-xs text-synapse-primary mb-6 uppercase tracking-[0.2em] sm:tracking-[0.4em]">Clinical Intelligence</div>
            <h2 className="text-4xl lg:text-6xl font-black uppercase mb-8 leading-[1.1] tracking-tight">The AI <br /> <span className="text-neutral-500">Workspace.</span></h2>
            <p className="text-lg font-bold text-neutral-400 mb-12 leading-relaxed">
              Every encounter screen features a persistent AI companion. It analyzes symptoms, vitals, and patient history against the Uganda Clinical Guidelines in real-time.
            </p>
            <ul className="space-y-6 mb-12">
               {[
                 'Grounded Differential Diagnosis',
                 'Automated SOAP Note Generation',
                 'Drug Interaction Safety Engine',
                 'Evidence-based Management Plans'
               ].map((f, i) => (
                 <li key={i} className="flex items-center gap-4 text-xs font-black uppercase tracking-widest">
                   <div className="w-6 h-6 rounded-lg bg-synapse-primary/10 border border-synapse-primary/20 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-synapse-primary" />
                   </div>
                   {f}
                 </li>
               ))}
            </ul>
            <Link to="/demo/doctor" className="btn-primary py-5 px-10 rounded-2xl inline-block">See Full AI Demo</Link>
          </div>
          <div className="relative group">
             <div className="card p-4 overflow-hidden border-synapse-primary/20 bg-synapse-black relative z-10">
                <div className="bg-synapse-dark rounded-xl h-[400px] border border-white/5 flex flex-col">
                   <div className="h-12 border-b border-white/5 px-6 flex items-center justify-between">
                      <div className="flex gap-2">
                         <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                         <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20" />
                         <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20" />
                      </div>
                      <div className="text-mono-xs text-neutral-600 tracking-[0.15em] sm:tracking-[0.3em]">ai_copilot_v9.log</div>
                   </div>
                   <div className="p-8 space-y-6 font-mono text-[11px]">
                      <div className="text-cyan-500 leading-relaxed animate-pulse"># Processing clinical context...</div>
                      <div className="text-neutral-400"># Patient presents with acute respiratory distress, SpO2 88%...</div>
                      <div className="bg-white/5 p-4 rounded-lg border border-white/5 text-neutral-300">
                         <span className="text-synapse-primary block mb-2 font-black tracking-widest uppercase text-[10px]">Differential Diagnoses:</span>
                         1. Severe Pneumonia (ICD-11: CA40) - 94% confidence<br />
                         2. Acute Heart Failure (ICD-11: BD10) - 72% confidence<br />
                         3. Pulmonary Embolism (ICD-11: BB40) - 45% confidence
                      </div>
                      <div className="text-emerald-500"># Recommendation: Start oxygen therapy immediately (UCG 2023, Sec 4.1)</div>
                   </div>
                </div>
             </div>
             <div className="absolute inset-0 bg-synapse-primary/20 blur-[100px] -z-10 group-hover:bg-synapse-primary/30 transition-colors" />
          </div>
        </div>
      </section>

      {/* SECTION 5: TELEMEDICINE PREVIEW */}
      <section className="py-24 lg:py-40 px-4 lg:px-12 bg-synapse-dark/30 border-y border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-20">
           <div className="order-2 lg:order-1 flex-1 relative">
              <div className="w-[300px] mx-auto aspect-[9/19] bg-synapse-black rounded-[3rem] border-[8px] border-neutral-900 overflow-hidden relative shadow-2xl">
                 <div className="absolute top-0 w-full h-8 flex justify-center items-end pb-1">
                    <div className="w-16 h-4 bg-neutral-900 rounded-full" />
                 </div>
                 <div className="h-full pt-10 px-6 space-y-6">
                    <div className="flex items-center gap-3">
                       <Logo size="sm" showText={false} />
                       <span className="text-[10px] font-black uppercase text-white">Telemedicine</span>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                       <p className="text-[11px] font-bold text-neutral-200">Hello! I'm your AI health guide. What is your main symptom today?</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-4">
                       {['Fever', 'Headache', 'Cough', 'Pain'].map(s => (
                         <div key={s} className="p-3 bg-white/5 border border-white/10 rounded-xl text-[8px] font-black uppercase text-center">{s}</div>
                       ))}
                    </div>
                    <div className="absolute bottom-6 left-6 right-6">
                       <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="w-[30%] h-full bg-emerald-500" />
                       </div>
                    </div>
                 </div>
              </div>
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-synapse-primary/20 blur-[60px] rounded-full" />
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/20 blur-[60px] rounded-full" />
           </div>
           <div className="order-1 lg:order-2 flex-1 space-y-8">
              <div className="text-mono-xs text-synapse-primary uppercase tracking-[0.4em]">Patient Ecosystem</div>
              <h2 className="text-4xl lg:text-6xl font-black uppercase leading-[1.1] tracking-tight">Care <br /> <span className="text-neutral-500">Everywhere.</span></h2>
              <p className="text-lg font-bold text-neutral-400 leading-relaxed">
                 The Synapse App connects patients directly to the clinical frontline. AI-guided triage ensures critical cases are fast-tracked while routine care happens via secure video.
              </p>
              <div className="grid sm:grid-cols-2 gap-6 pt-4">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white font-black uppercase text-xs">
                       <Smartphone className="w-4 h-4 text-synapse-primary" /> App-Native
                    </div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase leading-relaxed">Available for iOS and Android with full FHIR health record sync.</p>
                 </div>
                 <div className="space-y-2">
                    <div className="flex items-center gap-2 text-white font-black uppercase text-xs">
                       <Video className="w-4 h-4 text-emerald-500" /> Secure Video
                    </div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase leading-relaxed">End-to-end encrypted consultations with real-time AI transcription.</p>
                 </div>
              </div>
              <Link to="/tele" className="btn-primary py-5 px-10 rounded-2xl inline-flex items-center gap-3">
                 Try Telemedicine Demo <Video className="w-4 h-4" />
              </Link>
           </div>
        </div>
      </section>

      {/* SECTION 7: DEPARTMENTS */}
      <section id="departments" className="py-24 lg:py-40 px-4 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-mono-xs text-synapse-primary mb-6 uppercase tracking-[0.4em]">Clinical Coverage</h2>
            <p className="heading-huge uppercase">Every <span className="text-neutral-500">Department.</span></p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
             {[
               { icon: Stethoscope, label: 'OPD' },
               { icon: Activity, label: 'Emergency' },
               { icon: HeartPulse, label: 'ICU' },
               { icon: Microscope, label: 'Laboratory' },
               { icon: Pill, label: 'Pharmacy' },
               { icon: PieChart, label: 'SDG Center' },
               { icon: Smartphone, label: 'Patient App' },
               { icon: Globe, label: 'Telemedicine', href: '/tele' },
               { icon: Layout, label: 'Radiology' },
               { icon: Users, label: 'Staff Hub' },
               { icon: ShieldCheck, label: 'Compliance' },
               { icon: Clock, label: 'Workflow' }
             ].map((dept, i) => {
               const CardContent = (
                 <>
                    <dept.icon className="w-6 h-6 text-neutral-600 group-hover:text-synapse-primary transition-colors" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors">{dept.label}</span>
                 </>
               );

               if (dept.href) {
                 return (
                   <Link key={i} to={dept.href} className="card p-6 flex flex-col items-center text-center gap-4 hover:border-synapse-primary/30 transition-all group overflow-hidden border-synapse-primary/10 bg-synapse-primary/5">
                      {CardContent}
                      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <ChevronRight className="w-3 h-3 text-synapse-primary" />
                      </div>
                   </Link>
                 );
               }

               return (
                 <div key={i} className="card p-6 flex flex-col items-center text-center gap-4 hover:border-synapse-primary/30 transition-all cursor-default group overflow-hidden">
                    {CardContent}
                 </div>
               );
             })}
          </div>
        </div>
      </section>

      {/* SECTION 11: ABOUT THE TEAM */}
      <section id="about" className="py-24 lg:py-40 px-4 lg:px-12 border-y border-white/5 bg-synapse-dark/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-mono-xs text-synapse-primary mb-6 uppercase tracking-[0.4em]">The Architects</h2>
            <p className="heading-huge uppercase">Built by Africans, <span className="text-neutral-500">for Africa.</span></p>
          </div>

          <div className="grid md:grid-cols-2 gap-16 max-w-5xl mx-auto">
            <motion.div whileHover={{ y: -8 }} className="card p-6 sm:p-10 overflow-hidden break-words flex flex-col items-center text-center group relative shadow-2xl shadow-cyan-500/5 border-white/10">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                 <Activity className="w-24 h-24 text-synapse-primary" />
              </div>
              <div className="w-32 h-32 rounded-full mb-8 border-4 border-white/5 shadow-2xl overflow-hidden group-hover:scale-105 transition-transform relative z-10">
                <img src="/assets/team/tushabe-ebrine.png" className="w-full h-full object-cover" alt="Jason Ebrine Tushabe" />
              </div>
              <h3 className="text-2xl font-black mb-2 text-white uppercase tracking-tight">Jason Ebrine Tushabe</h3>
              <p className="text-mono-xs text-synapse-primary mb-8 font-black tracking-widest">CO-FOUNDER & CEO / CTO</p>
              <p className="text-neutral-400 text-sm font-medium leading-relaxed mb-10">
                Health informatician and self-taught software engineer. Built Habakkuk, a pharmacy system deployed across Uganda. Architected the entire Synapse ecosystem.
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
            
            <motion.div whileHover={{ y: -8 }} className="card p-6 sm:p-10 overflow-hidden break-words flex flex-col items-center text-center group relative shadow-2xl shadow-emerald-500/5 border-white/10">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                 <ShieldCheck className="w-24 h-24 text-emerald-500" />
              </div>
              <div className="w-32 h-32 rounded-full mb-8 border-4 border-white/5 shadow-2xl overflow-hidden group-hover:scale-105 transition-transform relative z-10">
                <img src="/assets/team/nathan-david.jpg" className="w-full h-full object-cover" alt="Nathan David" />
              </div>
              <h3 className="text-2xl font-black mb-2 text-white uppercase tracking-tight">Nathan David</h3>
              <p className="text-mono-xs text-synapse-primary mb-8 font-black tracking-widest">CO-FOUNDER & COO</p>
              <p className="text-neutral-400 text-sm font-medium leading-relaxed mb-10">
                Six years in healthcare financing and insurance in Uganda. Deep expertise in hospital revenue cycles and insurance system optimization. Leads partnerships.
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
            <Link to="/about" className="text-mono-xs text-neutral-600 hover:text-white transition-colors uppercase tracking-[0.15em] sm:tracking-[0.3em]">Read our story →</Link>
          </div>
        </div>
      </section>

      {/* SECTION 13: PRICING */}
      <section id="pricing" className="py-24 px-4 lg:py-40 lg:px-12 w-full max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-mono-xs text-synapse-primary mb-6 uppercase tracking-[0.4em]">Sustainable Scaling</h2>
          <p className="heading-huge uppercase">Pricing <span className="text-neutral-500">Tiers.</span></p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
           {[
             { id: 'trial', name: 'Pilot/Trial', price: 'Free', period: '30 Days', features: ['Full Department Access', 'AI Workspace (Limited)', 'Patient App Link', 'Basic Support'], cta: 'Request Pilot' },
             { id: 'starter', name: 'Starter', price: '9', period: 'per facility/mo', features: ['Up to 3 Departments', 'Patient Registry', 'Basic Pharmacy', 'Email Support'], cta: 'Get Started' },
             { id: 'professional', name: 'Professional', price: '49', period: 'per facility/mo', features: ['Unlimited Departments', 'Clinical AI Workspace', 'Insurance Copilot', 'Priority Support'], cta: 'Start Trial', highlight: true },
             { id: 'contact', name: 'Enterprise', price: 'Custom', period: 'Annual contract', features: ['Custom HL7/FHIR Bridging', 'Audit & Compliance Tools', 'On-Premise Fallback', '24/7 Dedicated Support'], cta: 'Contact Sales' }
           ].map((plan, i) => (
             <div key={i} className={cn(
               "p-6 sm:p-10 rounded-3xl border transition-all relative flex flex-col h-full overflow-hidden break-words",
               plan.highlight 
                ? "bg-white text-synapse-black border-synapse-primary shadow-2xl shadow-cyan-500/20 scale-105 z-10"
                : "bg-synapse-dark border-white/5"
             )}>
                {plan.highlight && <div className="absolute top-0 right-0 p-4 text-mono-xs text-synapse-primary bg-synapse-primary/10 rounded-bl-xl font-black tracking-widest uppercase">MOST POPULAR</div>}
                <div className={cn("text-mono-xs mb-6 uppercase tracking-widest font-black", plan.highlight ? 'text-synapse-primary' : 'text-neutral-600')}>{plan.name}</div>
                <div className="mb-10 flex items-baseline gap-1">
                   {!isNaN(Number(plan.price)) && <span className="text-4xl font-black text-white mr-1 align-top">$</span>}
                   <span className="text-5xl font-black tracking-tight">{plan.price}</span>
                   {plan.period && <span className="text-[10px] uppercase font-black text-neutral-500 ml-1">{plan.period}</span>}
                </div>
                <ul className="space-y-4 mb-12 flex-1">
                   {plan.features.map((f, j) => (
                     <li key={j} className="flex gap-3 items-start text-[10px] font-black uppercase tracking-tight opacity-100">
                       <CheckCircle className={cn("w-4 h-4 shrink-0", plan.highlight ? "text-synapse-primary" : "text-synapse-primary")} />
                       {f}
                     </li>
                   ))}
                </ul>
                <button
                  onClick={() => openPlan(plan.id)}
                  className={cn(
                  "w-full py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] block text-center transition-all",
                  plan.highlight ? "bg-synapse-black text-white hover:bg-neutral-900 shadow-xl" : "bg-white/5 border border-white/10 text-[var(--text-primary)] hover:bg-white/10"
                )}>
                  {plan.cta}
                </button>
             </div>
           ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-synapse-black border-t border-white/5 py-24 px-4 lg:py-40 lg:px-12">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-16 mb-32">
          <div className="col-span-1 sm:col-span-2">
            <div className="mb-8">
              <Logo size="md" variant="light" />
            </div>
            <p className="text-neutral-500 font-medium max-w-sm leading-relaxed mb-10 text-sm">
              Sovereign health operating system for Africa. Connecting clinical intelligence to every life.
            </p>
            <div className="flex flex-col gap-3 text-mono-xs text-neutral-700">
               <span className="flex items-center gap-2 uppercase tracking-widest font-black">🇺🇬 Built in Uganda</span>
               <span className="flex items-center gap-2 uppercase tracking-widest text-[9px] font-black">© Synapse Health Technologies Ltd</span>
            </div>
          </div>

          <div>
            <h4 className="text-mono-xs mb-10 text-white uppercase tracking-widest font-black">Product</h4>
            <ul className="space-y-6 text-[10px] font-black text-neutral-600 uppercase tracking-widest">
              <li><Link to="/features" className="hover:text-synapse-primary transition-colors">Features</Link></li>
              <li><Link to="/demo" className="hover:text-synapse-primary transition-colors">OS Demo</Link></li>
              <li><Link to="/tele" className="hover:text-synapse-primary transition-colors">Telemedicine</Link></li>
              <li><a href="#pricing" className="hover:text-synapse-primary transition-colors">Pricing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-mono-xs mb-10 text-white uppercase tracking-widest font-black">Company</h4>
            <ul className="space-y-6 text-[10px] font-black text-neutral-600 uppercase tracking-widest">
              <li><Link to="/about" className="hover:text-synapse-primary transition-colors">About</Link></li>
              <li><Link to="/blog" className="hover:text-synapse-primary transition-colors">Blog</Link></li>
              <li><Link to="/careers" className="hover:text-synapse-primary transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="hover:text-synapse-primary transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-mono-xs mb-10 text-white uppercase tracking-widest font-black">Legal</h4>
            <ul className="space-y-6 text-[10px] font-black text-neutral-600 uppercase tracking-widest">
              <li><Link to="/legal/privacy" className="hover:text-synapse-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/legal/terms" className="hover:text-synapse-primary transition-colors">Terms of Service</Link></li>
              <li><Link to="/legal/dpa" className="hover:text-synapse-primary transition-colors">Data Processing</Link></li>
              <li><Link to="/legal/accessibility" className="hover:text-synapse-primary transition-colors">Accessibility</Link></li>
            </ul>
          </div>
        </div>

        <div className="w-full max-w-7xl mx-auto pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-12">
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
