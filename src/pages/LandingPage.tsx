import { motion } from 'motion/react';
import { Shield, Activity, Users, Zap, CheckCircle, ArrowRight, Github, Linkedin, Mail, Play, BrainCircuit, Beaker, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

const codeSnippet = `POST /v1/synapse/admit

{
  "patient_id": "PT-88210",
  "facility": "MENGO-HOSP",
  "triage": "ACUITY_RED",
  "ai_diagnosis": true
}

// Response
{
  "status": "admitted ✓",
  "encounter_id": "ENC-001",
  "cdss_active": true,
  "confidence": "98.2%"
}`;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-synapse-black selection:bg-cyan-500/30 selection:text-cyan-200 font-sans text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-synapse-black/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-8 h-8 bg-synapse-primary rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 shadow-lg shadow-cyan-500/20">
            <Activity className="w-5 h-5 text-synapse-black" />
          </div>
          <span className="font-black text-xl tracking-tighter text-white uppercase">Synapse<span className="text-synapse-primary">OS</span></span>
        </div>
        <div className="hidden md:flex items-center gap-10 text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">
          <a href="#features" className="hover:text-synapse-primary transition-colors">Features</a>
          <a href="#founders" className="hover:text-synapse-primary transition-colors">Founders</a>
          <a href="#pricing" className="hover:text-synapse-primary transition-colors">Pricing</a>
          <Link to="/os/doctor/queue" className="hover:text-synapse-primary transition-colors">Live OS</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/auth/signin" className="text-[10px] font-bold text-neutral-400 hover:text-white transition-colors uppercase tracking-[0.2em] hidden sm:block">Sign In</Link>
          <Link to="/pilot/apply" className="btn-primary py-2 px-5 text-[10px]">
            Apply for Pilot
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 px-6 lg:px-12 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        {/* Background Glow */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-synapse-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-synapse-primary/10 text-synapse-primary text-[10px] font-bold uppercase tracking-[0.2em] border border-synapse-primary/20 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-synapse-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-synapse-primary"></span>
            </span>
            Sovereign Health Infrastructure
          </div>
          <h1 className="heading-huge mb-8">
            The new standard <br /> 
            <span className="text-gradient">for African care.</span>
          </h1>
          <p className="text-lg text-neutral-400 mb-10 max-w-lg leading-relaxed font-medium">
            Synapse is an offline-first clinical operating system designed for African healthcare facilities. Grounded in national guidelines, powered by sovereign AI.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/pilot/apply" className="btn-primary flex items-center gap-2">
              Request Pilot Access <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/demo" className="btn-secondary flex items-center gap-2">
              <Play className="w-4 h-4 fill-current" /> Try the Sandbox
            </Link>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          {/* Terminal Card */}
          <div className="card-elevated overflow-hidden shadow-cyan-500/5 group">
            <div className="h-10 bg-white/5 border-b border-white/10 flex items-center px-4 justify-between">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
              </div>
              <div className="text-mono-xs text-neutral-500">synapse_api_v2.ts</div>
            </div>
            <div className="p-6 font-mono text-xs leading-relaxed text-neutral-300 overflow-x-auto bg-synapse-black/40">
              <pre>
                <code>
                  {codeSnippet.split('\n').map((line, i) => {
                    const isKey = /^  "[a-z_]+"/.test(line);
                    const isComment = line.trim().startsWith('//');
                    const isSuccess = line.includes('✓');
                    return (
                      <div key={i} className="min-h-[1.25rem]">
                        <span className={cn(
                          isKey ? "text-synapse-primary" :
                          isComment ? "text-neutral-600" :
                          isSuccess ? "text-emerald-400 font-bold" : ""
                        )}>
                          {line}
                        </span>
                      </div>
                    );
                  })}
                </code>
              </pre>
            </div>
          </div>

          {/* AI Activity Float */}
          <div className="absolute -bottom-6 -right-6 glass p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-float border border-white/10">
            <div className="w-10 h-10 bg-synapse-primary rounded-lg flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 text-synapse-black" />
            </div>
            <div>
              <p className="text-mono-xs text-synapse-primary mb-0.5">AI Engine</p>
              <p className="text-xs font-bold leading-none">UCG Rule 5.1.A Validated</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats Bar */}
      <section className="bg-synapse-dark py-16 px-6 lg:px-12 border-y border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12">
           {[
             { label: 'AI Diagnosis Concordance', value: '94.2%' },
             { label: 'Triage Accuracy', value: '99.1%' },
             { label: 'Cloud Sync Latency', value: '<2ms' },
             { label: 'Grounded Guidelines', value: 'UCG 2023' }
           ].map((stat, i) => (
             <div key={i} className="text-center">
               <div className="text-4xl font-black text-white mb-2 tracking-tighter font-mono">{stat.value}</div>
               <div className="text-mono-xs text-neutral-500">{stat.label}</div>
             </div>
           ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 lg:px-12 max-w-7xl mx-auto relative">
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-synapse-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="mb-20">
          <h2 className="text-mono-xs text-synapse-primary mb-4">Core Ecosystem</h2>
          <p className="heading-1 max-w-2xl">Resilient Clinical Intelligence.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: 'Clinical AI Copilot',
              desc: 'Grounded in Uganda Clinical Guidelines (UCG). Real-time differential diagnosis using modern LLMs with local medical contexts.',
              icon: Activity
            },
            {
              title: 'Offline-First OS',
              desc: 'Continuous operation regardless of network status. Peer-to-peer local data synchronization with secured cloud backups.',
              icon: Zap
            },
            {
              title: 'Insurance Copilot',
              desc: 'Automated claim generation and real-time coverage checks for regional providers like IAA and UAP.',
              icon: Shield
            },
            {
              title: 'Inventory & Barcode',
              desc: 'FEFO-based dispensing with integrated drug interaction alerts and automated reorder triggers.',
              icon: Beaker
            },
            {
              title: 'Community Link',
              desc: 'Direct mobile access for patients to receive prescriptions, view lab results, and book remote clinical triage.',
              icon: Users
            },
            {
              title: 'One-Click Reporting',
              desc: 'Automated HMIS epidemiological reports for district health officers, formatted to MOH standards.',
              icon: CheckCircle
            }
          ].map((f, i) => (
            <div key={i} className="p-8 card-interactive group">
              <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-neutral-500 group-hover:text-synapse-primary transition-colors mb-8">
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-4 text-white">{f.title}</h3>
              <p className="text-neutral-400 text-sm leading-relaxed font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Founders Section */}
      <section id="founders" className="py-32 bg-synapse-dark/50 px-6 lg:px-12 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-mono-xs text-neutral-500 mb-4">The Architects</h2>
            <p className="heading-2">Built by Africans, <span className="text-neutral-500">for Africa.</span></p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="card p-10 flex flex-col items-center text-center group">
              <div className="w-24 h-24 rounded-full mb-8 border-2 border-white/10 shadow-xl overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white text-3xl font-black group-hover:scale-105 transition-transform">
                JT
              </div>
              <h3 className="text-xl font-bold mb-1 text-white">Jason Ebrine</h3>
              <p className="text-mono-xs text-synapse-primary mb-6">Co-Founder & CEO / CTO</p>
              <p className="text-neutral-400 text-sm font-medium leading-relaxed mb-8">
                Lead engineer who built the core clinical engine. Focused on infrastructure resilience and clinical safety for high-stakes medical delivery.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-neutral-400">
                  <Linkedin className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-neutral-400">
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </div>
            
            <div className="card p-10 flex flex-col items-center text-center group">
              <div className="w-24 h-24 rounded-full mb-8 border-2 border-white/10 shadow-xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-3xl font-black group-hover:scale-105 transition-transform">
                ND
              </div>
              <h3 className="text-xl font-bold mb-1 text-white">Nathan David</h3>
              <p className="text-mono-xs text-synapse-primary mb-6">Co-Founder & COO</p>
              <p className="text-neutral-400 text-sm font-medium leading-relaxed mb-8">
                Health financing analyst with regional expertice in hospital operations and insurance systems optimization across East Africa.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-neutral-400">
                  <Linkedin className="w-4 h-4" />
                </a>
                <a href="#" className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors text-neutral-400">
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-mono-xs text-synapse-primary mb-4">Pricing Strategy</h2>
          <p className="heading-2">Built to scale with your clinic.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
           {[
             { name: 'Starter', price: 'Free', features: ['Up to 5 Departments', 'Core Patient Registry', 'Basic Pharmacy POS', 'Community Link'], cta: 'Deploy Instance' },
             { name: 'Professional', price: '$49/mo', features: ['Unlimited Departments', 'Clinical AI Copilot', 'Insurance Gateway Sync', 'Hospital Admin Portal'], cta: 'Start Trial', highlight: true },
             { name: 'Enterprise', price: 'Custom', features: ['Multi-Tenant Admin', 'Custom HL7/FHIR Bridging', '24/7 Deployment Support', 'On-Premise Server Kit'], cta: 'Contact Sales' }
           ].map((plan, i) => (
             <div key={i} className={cn(
               "p-10 rounded-3xl border transition-all relative overflow-hidden",
               plan.highlight 
                ? "bg-white text-synapse-black border-synapse-primary shadow-2xl shadow-cyan-500/20 scale-105 z-10"
                : "bg-synapse-dark border-white/5"
             )}>
                {plan.highlight && <div className="absolute top-0 right-0 p-4 text-mono-xs text-synapse-primary bg-synapse-primary/10 rounded-bl-xl">Most Popular</div>}
                <div className="text-mono-xs mb-6 text-synapse-primary">{plan.name}</div>
                <div className="text-5xl font-black mb-10 tracking-tight">{plan.price}</div>
                <ul className="space-y-4 mb-12">
                   {plan.features.map((f, j) => (
                     <li key={j} className="flex gap-3 items-start text-xs font-bold opacity-80">
                       <CheckCircle className={cn("w-4 h-4 shrink-0", plan.highlight ? "text-synapse-primary" : "text-synapse-primary")} />
                       {f}
                     </li>
                   ))}
                </ul>
                <Link to="/pilot/apply" className={cn(
                  "w-full py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest block text-center transition-all",
                  plan.highlight ? "bg-synapse-black text-white hover:bg-neutral-800" : "btn-primary"
                )}>
                  {plan.cta}
                </Link>
             </div>
           ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-synapse-black border-t border-white/5 py-32 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-16 mb-24">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-synapse-primary rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                 <Activity className="w-5 h-5 text-synapse-black" />
              </div>
              <span className="font-black text-xl tracking-tighter text-white uppercase">Synapse<span className="text-synapse-primary">OS</span></span>
            </div>
            <p className="text-neutral-500 font-medium max-w-sm leading-relaxed mb-8 text-sm">
              Regional operating system for sovereign health infrastructure in Africa. Closing the clinical intelligence gap.
            </p>
            <div className="flex gap-6 text-mono-xs text-neutral-700">
               <span>EST. 2024</span>
               <span>Kampala, UG</span>
               <span>v2.0-stable</span>
            </div>
          </div>
          <div>
            <h4 className="text-mono-xs mb-8 text-white">Platform</h4>
            <ul className="space-y-4 text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
              <li><Link to="/features" className="hover:text-synapse-primary transition-colors">Features</Link></li>
              <li><Link to="/demo" className="hover:text-synapse-primary transition-colors">OS Demo</Link></li>
              <li><Link to="/pricing" className="hover:text-synapse-primary transition-colors">Pricing</Link></li>
              <li><Link to="/docs" className="hover:text-synapse-primary transition-colors">Protocol Docs</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-mono-xs mb-8 text-white">Company</h4>
            <ul className="space-y-4 text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
              <li><Link to="/about" className="hover:text-synapse-primary transition-colors">Foundery</Link></li>
              <li><Link to="/blog" className="hover:text-synapse-primary transition-colors">Manifesto</Link></li>
              <li><Link to="/careers" className="hover:text-synapse-primary transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="hover:text-synapse-primary transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-mono-xs mb-8 text-white">Legal</h4>
            <ul className="space-y-4 text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
              <li><Link to="/privacy" className="hover:text-synapse-primary transition-colors">Privacy</Link></li>
              <li><Link to="/terms" className="hover:text-synapse-primary transition-colors">Terms</Link></li>
              <li><Link to="/dpa" className="hover:text-synapse-primary transition-colors">DPA</Link></li>
              <li><Link to="/consent" className="hover:text-synapse-primary transition-colors">Consent</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
           <p className="text-[10px] font-bold text-neutral-700 uppercase tracking-widest text-center md:text-left">© 2026 Synapse Ecosystem. All data sovereign to user facilities.</p>
           <div className="flex gap-10">
              <Link to="/status" className="flex items-center gap-2 text-[10px] font-bold text-neutral-700 hover:text-synapse-primary transition-colors uppercase tracking-widest group">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:animate-ping" /> Network Active
              </Link>
           </div>
        </div>
      </footer>
    </div>
  );
}
