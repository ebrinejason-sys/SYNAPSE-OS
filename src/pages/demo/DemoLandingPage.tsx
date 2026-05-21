import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Play, Shield, Globe, Lock, ArrowRight, Activity, Beaker, Zap,
  Users, Stethoscope, Pill, Microscope, TrendingUp, AlertCircle,
  CheckCircle, Clock, MessageSquare, Heart, Brain
} from 'lucide-react';
import { SynapseLogo } from '../../components/ui/SynapseLogo';

export default function DemoLandingPage() {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-synapse-black text-white font-sans selection:bg-synapse-primary/30 selection:text-cyan-200">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-synapse-black/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="group">
            <SynapseLogo variant="light" className="text-neutral-900 group-hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-8">
            <a href="#features" className="text-mono-xs text-neutral-500 hover:text-synapse-primary transition-colors">Features</a>
            <a href="#demo" className="text-mono-xs text-neutral-500 hover:text-synapse-primary transition-colors">Demo</a>
            <Link to="/apply" className="btn-primary py-2 px-4 text-[10px]">Apply</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-40 px-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-synapse-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-10"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-synapse-primary/10 border border-synapse-primary/20 rounded-full text-mono-xs text-synapse-primary">
              <span className="w-2 h-2 bg-synapse-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
              Sandbox v2.0 — No Sign-up Required
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="heading-huge mb-10"
          >
            The Sovereign <br />
            <span className="text-gradient font-black">AI Health OS.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-neutral-400 mb-12 leading-relaxed max-w-2xl mx-auto font-medium"
          >
            Experience a fully functional clinical decision support system with real-time AI diagnosis, insurance integration, and offline-first architecture—all in our interactive sandbox.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24"
          >
            <Link to="/demo/doctor" className="btn-primary flex items-center gap-3 py-4 px-10">
              <Play className="w-5 h-5 fill-current" />
              Launch Clinical Demo
            </Link>
            <Link to="/apply" className="btn-secondary flex items-center gap-3 py-4 px-10">
              Request Pilot Access
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { label: 'Demo Facilities', value: '12+', icon: Users, color: 'text-synapse-primary' },
              { label: 'Patient Records', value: '500+', icon: Activity, color: 'text-emerald-500' },
              { label: 'Powered Diagnosis', value: 'AI', icon: Brain, color: 'text-amber-500' }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (i * 0.1) }}
                className="card p-8 flex flex-col items-center text-center group"
              >
                <stat.icon className={cn("w-10 h-10 mb-4 transition-transform group-hover:scale-110", stat.color)} />
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

            <motion.div
              className="card p-12 h-full flex flex-col opacity-40 grayscale relative overflow-hidden cursor-not-allowed"
            >
              <div className="absolute top-6 right-6 badge-warning">Coming Soon</div>
              <Beaker className="w-12 h-12 text-neutral-500 mb-8" />
              <h3 className="text-2xl font-black text-neutral-300 mb-4 uppercase tracking-tight">Pharmacy Module</h3>
              <p className="text-neutral-500 mb-10 leading-relaxed font-medium">
                Dispense medications, check interactions, manage inventory, and handle insurance coverage calculations.
              </p>
            </motion.div>
          </div>

          <div className="glass p-8 rounded-3xl flex flex-col sm:flex-row items-center gap-6 border border-white/5">
            <div className="w-12 h-12 rounded-xl bg-synapse-primary/10 flex items-center justify-center shrink-0">
               <AlertCircle className="w-6 h-6 text-synapse-primary" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-mono-xs text-white mb-1">Demo Credentials</p>
              <p className="text-neutral-500 text-sm font-medium leading-relaxed">
                Use <code className="bg-white/5 px-2 py-0.5 rounded text-synapse-primary">demo@synapseos.tech</code> / <code className="bg-white/5 px-2 py-0.5 rounded text-synapse-primary">Demo4321</code> to access the full platform demo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 px-6 relative overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-synapse-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="heading-huge mb-10 uppercase tracking-tighter">Ready for <br /> <span className="text-gradient">Pilot?</span></h2>
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
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <Link to="/" className="inline-block mb-4 group">
                <SynapseLogo variant="light" className="text-neutral-900 group-hover:opacity-80 transition-opacity" />
              </Link>
              <p className="text-xs text-neutral-500 leading-relaxed font-medium uppercase tracking-widest">Sovereign AI health operating system for Africa.</p>
            </div>
            <div>
              <p className="text-mono-xs text-white mb-6">Product</p>
              <ul className="space-y-4 text-xs font-black text-neutral-600 uppercase tracking-widest">
                <li><a href="#features" className="hover:text-synapse-primary transition-colors">Features</a></li>
                <li><a href="#demo" className="hover:text-synapse-primary transition-colors">Demo</a></li>
                <li><Link to="/pricing" className="hover:text-synapse-primary transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-mono-xs text-white mb-6">Company</p>
              <ul className="space-y-4 text-xs font-black text-neutral-600 uppercase tracking-widest">
                <li><a href="#" className="hover:text-synapse-primary transition-colors">About</a></li>
                <li><a href="#" className="hover:text-synapse-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-synapse-primary transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <p className="text-mono-xs text-white mb-6">Legal</p>
              <ul className="space-y-4 text-xs font-black text-neutral-600 uppercase tracking-widest">
                <li><Link to="/legal/privacy" className="hover:text-synapse-primary transition-colors">Privacy</Link></li>
                <li><Link to="/legal/terms" className="hover:text-synapse-primary transition-colors">Terms</Link></li>
                <li><a href="#" className="hover:text-synapse-primary transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-12 text-center">
            <p className="text-mono-xs text-neutral-700">
              © 2026 Synapse Ecosystem. Built with ❤️ for Africa.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
