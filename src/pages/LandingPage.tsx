import { motion } from 'motion/react';
import { Shield, Activity, Users, Zap, CheckCircle, ArrowRight, Github, Linkedin, Mail, Play, BrainCircuit, Beaker } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-page selection:bg-emerald-100 selection:text-emerald-900 font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 h-16 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
            <div className="w-4 h-4 bg-white rounded-full opacity-90 shadow-sm" />
          </div>
          <span className="font-extrabold text-xl tracking-tighter text-slate-900 uppercase">Synapse<span className="text-emerald-600">OS</span></span>
        </div>
        <div className="hidden md:flex items-center gap-10 text-sm font-bold text-slate-500 uppercase tracking-widest">
          <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
          <a href="#founders" className="hover:text-slate-900 transition-colors">Founders</a>
          <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
          <Link to="/os/doctor/queue" className="hover:text-emerald-600 transition-colors">Live OS</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/auth/signin" className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest hidden sm:block">Sign In</Link>
          <Link to="/pilot/apply" className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
            Apply for Pilot
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 lg:px-12 max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-[0.25em] border border-emerald-100 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Sovereign Health Infrastructure
          </div>
          <h1 className="text-6xl lg:text-8xl font-black text-slate-900 leading-[0.95] tracking-tighter mb-8">
            The new standard <br /> 
            <span className="text-emerald-600">for African care.</span>
          </h1>
          <p className="text-lg text-slate-500 mb-10 max-w-lg leading-relaxed font-medium">
            Synapse is an offline-first clinical operating system designed for African healthcare facilities. Grounded in national guidelines, powered by sovereign AI.
          </p>
          <div className="flex flex-wrap gap-6">
            <Link to="/pilot/apply" className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-2xl shadow-slate-300 hover:scale-105">
              Request Pilot Access <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/demo" className="bg-white border-2 border-slate-100 text-slate-900 px-10 py-5 rounded-[2rem] text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
              <Play className="w-4 h-4 fill-current" /> Try the Sandbox
            </Link>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative group"
        >
          <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 rounded-[3rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden aspect-video group-hover:border-emerald-200 transition-all">
            {/* Fake OS Preview */}
            <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-6 justify-between">
                <div className="flex gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                   <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                   <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">synapse_os_v2.0_enc-88210</div>
            </div>
            <div className="p-8 h-full bg-white flex flex-col gap-6">
               <div className="flex items-center justify-between">
                  <div className="space-y-2">
                     <div className="h-4 w-40 bg-slate-900 rounded-lg" />
                     <div className="h-3 w-32 bg-slate-100 rounded-md" />
                  </div>
                  <div className="flex gap-2">
                     <div className="h-8 w-8 bg-slate-50 rounded-lg border border-slate-100" />
                     <div className="h-8 w-8 bg-slate-50 rounded-lg border border-slate-100" />
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="h-24 bg-red-50/50 rounded-2xl border border-red-100 p-4 relative">
                     <div className="h-2 w-12 bg-red-200 rounded mb-2" />
                     <div className="h-4 w-full bg-red-600/20 rounded" />
                  </div>
                  <div className="h-24 bg-emerald-50/50 rounded-2xl border border-emerald-100 p-4">
                     <div className="h-2 w-12 bg-emerald-200 rounded mb-2" />
                     <div className="h-4 w-full bg-emerald-600/20 rounded" />
                  </div>
               </div>
               <div className="flex-1 bg-slate-50 rounded-[1.5rem] border border-slate-100 p-6">
                  <div className="h-2 w-full bg-slate-200 rounded mb-3" />
                  <div className="h-2 w-5/6 bg-slate-200 rounded mb-3" />
                  <div className="h-2 w-4/6 bg-slate-200 rounded" />
                  <div className="mt-8 flex gap-3">
                     <div className="h-10 w-32 bg-slate-900 rounded-xl" />
                     <div className="h-10 w-32 bg-white border border-slate-200 rounded-xl" />
                  </div>
               </div>
            </div>
          </div>
          {/* AI Activity Float */}
          <div className="absolute top-6 right-6 bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center gap-4 animate-float border border-white/10 group-hover:scale-105 transition-transform">
            <BrainCircuit className="w-6 h-6 text-emerald-400" />
            <div>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-0.5">AI Check</p>
              <p className="text-xs font-semibold leading-none">UCG Rule 5.1.A Validated</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Stats Bar */}
      <section className="bg-slate-950 py-16 px-6 lg:px-12 border-y border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12">
           {[
             { label: 'AI Diagnosis Concordance', value: '94.2%' },
             { label: 'Triage Accuracy', value: '99.1%' },
             { label: 'Cloud Sync Latency', value: '<2ms' },
             { label: 'Grounded Guidelines', value: 'UCG 2023' }
           ].map((stat, i) => (
             <div key={i} className="text-center">
               <div className="text-4xl font-black text-white mb-2 tracking-tighter">{stat.value}</div>
               <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.25em]">{stat.label}</div>
             </div>
           ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="mb-20">
          <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-[0.3em] mb-4">Core Ecosystem</h2>
          <p className="text-4xl font-black text-slate-900 tracking-tight leading-[1.1]">Resilient Clinical Intelligence.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
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
            <div key={i} className="p-10 rounded-[2rem] border border-slate-100 bg-white hover:shadow-2xl hover:shadow-slate-200/50 hover:border-emerald-100 transition-all group">
              <div className="w-16 h-16 bg-bg-page border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors mb-8 shadow-sm">
                <f.icon className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">{f.title}</h3>
              <p className="text-slate-500 leading-relaxed font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Founders Section */}
      <section id="founders" className="py-32 bg-slate-50/50 px-6 lg:px-12 border-y border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">The Architects</h2>
            <p className="text-4xl font-black text-slate-900 tracking-tight">Built by Africans, <br /><span className="text-slate-400">for Africa.</span></p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-full mb-8 border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white text-4xl font-black">
                JT
              </div>
              <h3 className="text-2xl font-bold mb-1 text-slate-900">Jason Ebrine</h3>
              <p className="text-emerald-600 font-bold text-xs mb-6 uppercase tracking-widest">Co-Founder & CEO / CTO</p>
              <p className="text-slate-500 font-medium leading-relaxed mb-8">
                Lead engineer who built the core clinical engine. Focused on infrastructure resilience and clinical safety for high-stakes medical delivery.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-12 h-12 rounded-2xl bg-bg-page border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="#" className="w-12 h-12 rounded-2xl bg-bg-page border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400">
                  <Github className="w-5 h-5" />
                </a>
              </div>
            </div>
            
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-full mb-8 border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-white text-4xl font-black">
                ND
              </div>
              <h3 className="text-2xl font-bold mb-1 text-slate-900">Nathan David</h3>
              <p className="text-emerald-600 font-bold text-xs mb-6 uppercase tracking-widest">Co-Founder & COO</p>
              <p className="text-slate-500 font-medium leading-relaxed mb-8">
                Health financing analyst with regional expertice in hospital operations and insurance systems optimization across East Africa.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-12 h-12 rounded-2xl bg-bg-page border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="#" className="w-12 h-12 rounded-2xl bg-bg-page border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-400">
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-[0.3em] mb-4">Pricing Strategy</h2>
          <p className="text-4xl font-black text-slate-900 tracking-tight">Built to scale with your clinic.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
           {[
             { name: 'Starter', price: 'Free', features: ['Up to 5 Departments', 'Core Patient Registry', 'Basic Pharmacy POS', 'Community Link'], cta: 'Deploy Instance' },
             { name: 'Professional', price: '$49/mo', features: ['Unlimited Departments', 'Clinical AI Copilot', 'Insurance Gateway Sync', 'Hospital Admin Portal'], cta: 'Start Trial', highlight: true },
             { name: 'Enterprise', price: 'Custom', features: ['Multi-Tenant Admin', 'Custom HL7/FHIR Bridging', '24/7 Deployment Support', 'On-Premise Server Kit'], cta: 'Contact Sales' }
           ].map((plan, i) => (
             <div key={i} className={cn(
               "p-12 rounded-[3rem] border transition-all relative overflow-hidden",
               plan.highlight 
                ? "bg-slate-950 text-white border-emerald-500 shadow-2xl shadow-emerald-500/10 scale-105 z-10" 
                : "bg-white border-slate-100"
             )}>
                {plan.highlight && <div className="absolute top-0 right-0 p-4 font-black text-[10px] uppercase tracking-widest text-emerald-500">Most Popular</div>}
                <div className="text-[10px] font-black mb-6 uppercase tracking-[0.2em] text-emerald-500">{plan.name}</div>
                <div className="text-5xl font-black mb-10 tracking-tight">{plan.price}</div>
                <ul className="space-y-5 mb-12">
                   {plan.features.map((f, j) => (
                     <li key={j} className="flex gap-4 items-start text-sm font-medium opacity-90">
                       <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                       {f}
                     </li>
                   ))}
                </ul>
                <Link to="/pilot/apply" className={cn(
                  "w-full py-5 rounded-2xl font-bold text-[10px] uppercase tracking-widest block text-center transition-all",
                  plan.highlight ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-slate-900 text-white hover:bg-slate-800"
                )}>
                  {plan.cta}
                </Link>
             </div>
           ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-32 px-6 lg:px-12 font-sans">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-16 mb-24">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold transition-transform hover:scale-105">
                 <div className="w-4 h-4 bg-white rounded-full opacity-90" />
              </div>
              <span className="font-extrabold text-xl tracking-tighter text-slate-900 uppercase">Synapse<span className="text-emerald-600">OS</span></span>
            </div>
            <p className="text-slate-400 font-medium max-w-sm leading-relaxed mb-8">
              Regional operating system for sovereign health infrastructure in Africa. Closing the clinical intelligence gap.
            </p>
            <div className="flex gap-6 text-[10px] font-black text-slate-300 uppercase tracking-widest">
               <span>EST. 2024</span>
               <span>Built in Kampala</span>
               <span>v2.0-stable</span>
            </div>
          </div>
          <div>
            <h4 className="font-black mb-8 text-[10px] uppercase tracking-[0.25em] text-slate-900">Platform</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-400">
              <li><Link to="/features" className="hover:text-emerald-600 transition-colors">Features</Link></li>
              <li><Link to="/demo" className="hover:text-emerald-600 transition-colors">OS Demo</Link></li>
              <li><Link to="/pricing" className="hover:text-emerald-600 transition-colors">Pricing</Link></li>
              <li><Link to="/docs" className="hover:text-emerald-600 transition-colors">Protocol Docs</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black mb-8 text-[10px] uppercase tracking-[0.25em] text-slate-900">Company</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-400">
              <li><Link to="/about" className="hover:text-emerald-600 transition-colors">Foundery</Link></li>
              <li><Link to="/blog" className="hover:text-emerald-600 transition-colors">Manifesto</Link></li>
              <li><Link to="/careers" className="hover:text-emerald-600 transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="hover:text-emerald-600 transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black mb-8 text-[10px] uppercase tracking-[0.25em] text-slate-900">Legal</h4>
            <ul className="space-y-4 text-sm font-bold text-slate-400">
              <li><Link to="/privacy" className="hover:text-emerald-600 transition-colors">Privacy</Link></li>
              <li><Link to="/terms" className="hover:text-emerald-600 transition-colors">Terms</Link></li>
              <li><Link to="/dpa" className="hover:text-emerald-600 transition-colors">DPA</Link></li>
              <li><Link to="/consent" className="hover:text-emerald-600 transition-colors">Consent</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-16 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
           <p className="text-xs font-bold text-slate-300 uppercase tracking-widest text-center md:text-left">© 2026 Synapse Ecosystem. All data sovereign to user facilities.</p>
           <div className="flex gap-10">
              <Link to="/status" className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-emerald-500 transition-colors uppercase tracking-widest">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Network Active
              </Link>
           </div>
        </div>
      </footer>
    </div>
  );
}

