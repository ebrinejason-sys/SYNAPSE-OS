import React from 'react';
import { motion } from 'motion/react';
import { 
  Activity,
  ArrowRight,
  Stethoscope,
  Microscope,
  Pill,
  Brain,
  Shield,
  Globe,
  Video,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Logo } from '../../components/Logo';

export default function DemoLandingPage() {
  const stats = [
    { label: 'Active Pilots', value: '12', icon: Activity, color: 'text-synapse-primary' },
    { label: 'Patient Records', value: '40k+', icon: Shield, color: 'text-emerald-500' },
    { label: 'Uptime SLA', value: '99.9%', icon: Globe, color: 'text-blue-500' },
    { label: 'Latency', value: '<200ms', icon: Brain, color: 'text-purple-500' },
  ];

  return (
    <div className="min-h-screen bg-synapse-black text-white selection:bg-synapse-primary/30">
      {/* Hero Section */}
      <section className="pt-32 pb-40 px-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-synapse-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-synapse-primary/10 border border-synapse-primary/20 rounded-full text-mono-xs text-synapse-primary mb-12"
          >
            <span className="w-2 h-2 bg-synapse-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
            Interactive Demo Sandbox
          </motion.div>

          <h1 className="heading-huge mb-12 uppercase tracking-tighter">
            Experience the <br /> <span className="text-neutral-500">Future of Care.</span>
          </h1>

          <p className="text-xl text-neutral-400 max-w-3xl mx-auto mb-16 font-medium leading-relaxed">
            Welcome to the Synapse OS playground. Explore our clinical workflows, AI diagnostic workspace, and connected patient ecosystem.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-32">
            <Link to="/demo/doctor" className="btn-primary flex items-center gap-3 py-4 px-10">
              Launch Doctor OS <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/tele" className="btn-secondary flex items-center gap-3 py-4 px-10 border-white/10">
              Start Telemedicine <Video className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="card p-8 flex flex-col items-center text-center group"
              >
                <stat.icon className={cn("w-6 h-6 mb-4 transition-transform group-hover:scale-110", stat.color)} />
                <p className="text-4xl font-black text-white mb-2 tracking-tighter">{stat.value}</p>
                <p className="text-mono-xs text-neutral-500">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 bg-synapse-dark/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 text-center">
            <h2 className="text-mono-xs text-synapse-primary mb-4">Key Capabilities</h2>
            <p className="heading-2">Clinical Intelligence at Scale.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Stethoscope,
                title: 'AI Clinical Decision',
                description: 'Real-time diagnosis support grounded in Uganda Clinical Guidelines',
                color: 'text-synapse-primary',
                bg: 'bg-synapse-primary/10'
              },
              {
                icon: Microscope,
                title: 'Lab Management',
                description: 'FEFO inventory, critical value alerts, and result automation',
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10'
              },
              {
                icon: Pill,
                title: 'Pharmacy Integration',
                description: 'Drug interaction checking, insurance copay calculation, STAT orders',
                color: 'text-amber-500',
                bg: 'bg-amber-500/10'
              },
              {
                icon: Brain,
                title: 'Guideline Grounding',
                description: 'Every recommendation backed by national clinical guidelines',
                color: 'text-cyan-400',
                bg: 'bg-cyan-400/10'
              },
              {
                icon: Shield,
                title: 'Data Security',
                description: 'End-to-end encryption, role-based access, and audit logs',
                color: 'text-red-500',
                bg: 'bg-red-500/10'
              },
              {
                icon: Globe,
                title: 'Offline-First',
                description: 'Full functionality without internet connection',
                color: 'text-blue-500',
                bg: 'bg-blue-500/10'
              },
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -8 }}
                className="card-interactive p-8 group"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110", feature.bg)}>
                  <feature.icon className={cn("w-7 h-7", feature.color)} />
                </div>
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tight">{feature.title}</h3>
                <p className="text-neutral-400 text-sm leading-relaxed font-medium">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-mono-xs text-synapse-primary mb-4">Try the Demo</h2>
            <p className="heading-2">Clinical Workspaces.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-10 mb-16">
            <Link to="/demo/doctor" className="group">
              <motion.div
                whileHover={{ y: -8 }}
                className="card-interactive p-12 h-full flex flex-col"
              >
                <Activity className="w-12 h-12 text-synapse-primary mb-8 transition-transform group-hover:scale-110" />
                <h3 className="text-2xl font-black text-white mb-4 uppercase">Doctor Queue</h3>
                <p className="text-neutral-400 mb-10 leading-relaxed font-medium">
                  View the OPD patient queue sorted by acuity. Click on any patient to open their encounter and experience the full clinical workflow.
                </p>
                <div className="mt-auto flex items-center gap-3 text-synapse-primary text-mono-xs group-hover:translate-x-2 transition-transform">
                  Open Dashboard <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            </Link>

            <Link to="/tele" className="group">
              <motion.div
                whileHover={{ y: -8 }}
                className="card-interactive p-12 h-full flex flex-col relative overflow-hidden"
              >
                <div className="absolute top-6 right-6 badge-primary uppercase text-[8px] font-black tracking-widest">Demo Live</div>
                <Video className="w-12 h-12 text-synapse-primary mb-8 transition-transform group-hover:scale-110" />
                <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-tight">Telemedicine Flow</h3>
                <p className="text-neutral-400 mb-10 leading-relaxed font-medium">
                  Experience the 13-step guided symptom chatbot, automated triage, and the virtual consultation room stub.
                </p>
                <div className="mt-auto flex items-center gap-3 text-synapse-primary text-mono-xs group-hover:translate-x-2 transition-transform">
                   Start Chatbot <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            </Link>
          </div>

          <div className="card p-8 rounded-3xl flex flex-col sm:flex-row items-center gap-6 border border-white/5">
            <div className="w-12 h-12 rounded-xl bg-synapse-primary/10 flex items-center justify-center shrink-0">
               <AlertCircle className="w-6 h-6 text-synapse-primary" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-mono-xs text-white mb-1 tracking-widest">Demo Credentials</p>
              <p className="text-neutral-500 text-sm font-medium leading-relaxed uppercase tracking-tight">
                Use <code className="bg-white/5 px-2 py-0.5 rounded text-synapse-primary lowercase">demodoc@synapseos.tech</code> / <code className="bg-white/5 px-2 py-0.5 rounded text-synapse-primary">Demo4321</code> to access the full platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 px-6 relative overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-synapse-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="heading-huge mb-10 uppercase tracking-tighter">Ready for <br /> <span className="text-neutral-500">Pilot?</span></h2>
          <p className="text-xl text-neutral-400 mb-12 font-medium">
            Join leading health facilities transforming care with Synapse OS.
          </p>
          <Link to="/apply" className="btn-primary inline-flex items-center gap-4 py-5 px-12">
            Request Pilot Access
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-24 px-6 bg-synapse-black">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-16 mb-20 text-center md:text-left">
            <div className="col-span-1 sm:col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-6 justify-center md:justify-start">
                <Logo size="sm" />
              </Link>
              <p className="text-xs text-neutral-500 leading-relaxed font-medium uppercase tracking-widest">Sovereign AI health operating system for Africa.</p>
            </div>
            <div>
              <p className="text-mono-xs text-white mb-6">Product</p>
              <ul className="space-y-4 text-xs font-black text-neutral-600 uppercase tracking-widest">
                <li><Link to="/features" className="hover:text-synapse-primary transition-colors">Features</Link></li>
                <li><Link to="/demo" className="hover:text-synapse-primary transition-colors">Demo</Link></li>
                <li><a href="#pricing" className="hover:text-synapse-primary transition-colors">Pricing</a></li>
              </ul>
            </div>
            <div>
              <p className="text-mono-xs text-white mb-6">Company</p>
              <ul className="space-y-4 text-xs font-black text-neutral-600 uppercase tracking-widest">
                <li><Link to="/about" className="hover:text-synapse-primary transition-colors">About</Link></li>
                <li><Link to="/blog" className="hover:text-synapse-primary transition-colors">Blog</Link></li>
                <li><Link to="/careers" className="hover:text-synapse-primary transition-colors">Careers</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-mono-xs text-white mb-6">Legal</p>
              <ul className="space-y-4 text-xs font-black text-neutral-600 uppercase tracking-widest">
                <li><Link to="/legal/privacy" className="hover:text-synapse-primary transition-colors">Privacy</Link></li>
                <li><Link to="/legal/terms" className="hover:text-synapse-primary transition-colors">Terms</Link></li>
                <li><Link to="/contact" className="hover:text-synapse-primary transition-colors">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-12 text-center">
            <p className="text-mono-xs text-neutral-700 uppercase tracking-widest">
              © 2026 Synapse Health Technologies Ltd. Built in Uganda.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
