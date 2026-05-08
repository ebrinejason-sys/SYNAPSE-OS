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
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { ThemeToggle } from '../components/ThemeToggle';
import { Logo } from '../components/Logo';

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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-synapse-black/90 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="card w-full max-w-lg p-6 sm:p-10 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-6">
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-6 h-6 text-neutral-500" />
          </button>
        </div>

        <div className="text-mono-xs text-synapse-primary mb-2 uppercase tracking-[0.15em] sm:tracking-[0.3em]">Tier Selected</div>
        <h2 className="text-3xl sm:text-4xl font-black uppercase mb-8 tracking-tighter">{plan.name}</h2>

        <div className="mb-10 p-6 bg-white/5 rounded-2xl border border-white/5">
           <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">Price Estimate</div>
           <div className="text-3xl font-black">{!isNaN(Number(plan.price)) && <span className="text-2xl font-black text-synapse-primary mr-1">$</span>}{plan.price}</div>
        </div>

        <ul className="space-y-4 mb-12">
          {plan.features.map((f: string, i: number) => (
            <li key={i} className="flex items-center gap-3 text-[11px] font-black uppercase tracking-tight text-neutral-400">
              <CheckCircle className="w-4 h-4 text-synapse-primary" />
              {f}
            </li>
          ))}
        </ul>

        <Link
          to={selectedPlan === 'contact' ? '/contact' : `/apply?plan=${selectedPlan}`}
          className="btn-primary w-full py-5 text-center block"
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
    <div className="min-h-screen bg-synapse-black text-[var(--text-primary)] selection:bg-synapse-primary/30 selection:text-cyan-200">
      <AnimatePresence>
        {isModalOpen && <PricingModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} selectedPlan={selectedPlan} />}
      </AnimatePresence>

      <nav className="fixed top-0 w-full z-50 bg-synapse-black/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between px-6 lg:px-12">
        <Logo size="sm" />

        <div className="hidden lg:flex items-center gap-10 text-mono-xs text-neutral-500">
          <Link to="/features" className="hover:text-white transition-colors">Features</Link>
          <a href="#departments" className="hover:text-white transition-colors">Departments</a>
          <Link to="/demo" className="hover:text-white transition-colors">Demo</Link>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/login" className="text-mono-xs text-[var(--text-primary)] hover:text-synapse-primary transition-colors hidden sm:block">Sign In</Link>
          <Link to="/apply" className="btn-primary py-2.5 px-6 text-[10px]">Get Started</Link>
        </div>
      </nav>

      {/* SECTION 2: HERO */}
      <section className="relative pt-32 pb-20 px-4 lg:pt-48 lg:pb-32 lg:px-12 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-block px-4 py-1.5 rounded-full bg-synapse-primary/10 border border-synapse-primary/20 text-[10px] font-black text-synapse-primary uppercase tracking-[0.2em] sm:tracking-[0.4em] mb-12"
          >
            Sovereign Health Infrastructure
          </motion.div>
          <h1 className="heading-huge uppercase mb-12">Connecting <br /> <span className="text-neutral-500">Intelligence</span> <br /> to every life.</h1>
          <p className="text-xl lg:text-2xl font-bold max-w-3xl mx-auto text-neutral-400 mb-16 leading-relaxed">
            The first AI-native health operating system built in Uganda for the clinical frontline. One ecosystem, two products, infinite scale.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
             <Link to="/demo" className="btn-primary py-5 px-10 rounded-2xl w-full sm:w-auto">Launch Interactive Demo</Link>
             <Link to="/apply" className="btn-secondary py-5 px-10 rounded-2xl w-full sm:w-auto">Apply for Pilot Access</Link>
          </div>
        </div>

        {/* Hero visual background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] bg-synapse-primary/5 rounded-full blur-[120px] -z-10" />
      </section>

      {/* SECTION 11: ABOUT THE TEAM */}
      <section id="about" className="py-20 px-4 lg:py-32 lg:px-12 bg-synapse-dark/50 border-y border-white/5">
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
              <div className="w-32 h-32 rounded-full mb-8 border-4 border-white/5 shadow-2xl overflow-hidden group-hover:scale-105 transition-transform relative z-10">
                <img src="/assets/team/tushabe-ebrine.png" className="w-full h-full object-cover" />
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
            
            <motion.div whileHover={{ y: -8 }} className="card p-10 flex flex-col items-center text-center group relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                 <ShieldCheck className="w-24 h-24 text-emerald-500" />
              </div>
              <div className="w-32 h-32 rounded-full mb-8 border-4 border-white/5 shadow-2xl overflow-hidden group-hover:scale-105 transition-transform relative z-10">
                <img src="/assets/team/nathan-david.jpg" className="w-full h-full object-cover" />
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
      <section id="pricing" className="py-24 px-4 lg:py-40 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-mono-xs text-synapse-primary mb-6">Sustainable Scaling</h2>
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
               "p-10 rounded-3xl border transition-all relative overflow-hidden flex flex-col h-full",
               plan.highlight 
                ? "bg-white text-synapse-black border-synapse-primary shadow-2xl shadow-cyan-500/20 scale-105 z-10"
                : "bg-synapse-dark border-white/5"
             )}>
                {plan.highlight && <div className="absolute top-0 right-0 p-4 text-mono-xs text-synapse-primary bg-synapse-primary/10 rounded-bl-xl font-black">MOST POPULAR</div>}
                <div className={cn("text-mono-xs mb-6 uppercase tracking-widest", plan.highlight ? 'text-synapse-primary' : 'text-neutral-600')}>{plan.name}</div>
                <div className="mb-10">
                   <span className="text-3xl font-black text-synapse-primary mr-1 align-top mt-1 inline-block">{!isNaN(Number(plan.price)) && "$"}</span><span className="text-5xl font-black tracking-tight">{plan.price}</span>
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
                <button
                  onClick={() => openPlan(plan.id)}
                  className={cn(
                  "w-full py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] block text-center transition-all",
                  plan.highlight ? "bg-synapse-black text-white hover:bg-neutral-900 shadow-xl" : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                )}>
                  {plan.cta}
                </button>
             </div>
           ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-synapse-black border-t border-white/5 py-24 px-4 lg:py-40 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-16 mb-32">
          <div className="col-span-2">
            <div className="mb-8">
              <Logo size="md" />
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
