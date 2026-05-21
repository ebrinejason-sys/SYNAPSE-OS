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
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-green-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="group">
            <SynapseLogo variant="light" className="text-neutral-900 group-hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm font-medium text-neutral-600 hover:text-green-600 transition">Features</a>
            <a href="#demo" className="text-sm font-medium text-neutral-600 hover:text-green-600 transition">Demo</a>
            <Link to="/apply" className="btn-primary text-sm">Apply for Pilot</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100/50 border border-green-200 rounded-full text-xs font-bold text-green-700 uppercase tracking-widest">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Sandbox v2.0 — No Sign-up Required
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-bold text-neutral-900 mb-6 leading-tight"
          >
            The Sovereign AI Health OS for Africa
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-neutral-600 mb-12 leading-relaxed max-w-2xl mx-auto"
          >
            Experience a fully functional clinical decision support system with real-time AI diagnosis, insurance integration, and offline-first architecture—all in our interactive sandbox.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
          >
            <Link to="/demo/doctor" className="btn-primary flex items-center gap-2 text-lg py-3 px-8">
              <Play className="w-5 h-5" />
              Launch Clinical Demo
            </Link>
            <Link to="/apply" className="btn-outline flex items-center gap-2 text-lg py-3 px-8">
              Request Pilot Access
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card p-6"
            >
              <Users className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <p className="text-3xl font-bold text-neutral-900">12+</p>
              <p className="text-sm text-neutral-500">Demo Facilities</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card p-6"
            >
              <Activity className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <p className="text-3xl font-bold text-neutral-900">500+</p>
              <p className="text-sm text-neutral-500">Patient Records</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="card p-6"
            >
              <Brain className="w-8 h-8 text-purple-600 mx-auto mb-3" />
              <p className="text-3xl font-bold text-neutral-900">AI</p>
              <p className="text-sm text-neutral-500">Powered Diagnosis</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6 bg-white border-t border-neutral-200">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-neutral-900 mb-16">Key Capabilities</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Stethoscope,
                title: 'AI Clinical Decision',
                description: 'Real-time diagnosis support grounded in Uganda Clinical Guidelines',
                color: 'green',
              },
              {
                icon: Microscope,
                title: 'Lab Management',
                description: 'FEFO inventory, critical value alerts, and result automation',
                color: 'blue',
              },
              {
                icon: Pill,
                title: 'Pharmacy Integration',
                description: 'Drug interaction checking, insurance copay calculation, STAT orders',
                color: 'emerald',
              },
              {
                icon: Brain,
                title: 'Guideline Grounding',
                description: 'Every recommendation backed by national clinical guidelines',
                color: 'purple',
              },
              {
                icon: Shield,
                title: 'Data Security',
                description: 'End-to-end encryption, role-based access, and audit logs',
                color: 'red',
              },
              {
                icon: Globe,
                title: 'Offline-First',
                description: 'Full functionality without internet connection',
                color: 'indigo',
              },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              const colorClass = {
                green: 'from-green-500 to-emerald-500',
                blue: 'from-blue-500 to-cyan-500',
                emerald: 'from-emerald-500 to-teal-500',
                purple: 'from-purple-500 to-pink-500',
                red: 'from-red-500 to-orange-500',
                indigo: 'from-indigo-500 to-blue-500',
              }[feature.color];

              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -8 }}
                  className="card-interactive p-8 group cursor-pointer"
                  onMouseEnter={() => setHoveredCard(`feature-${idx}`)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className={`w-14 h-14 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-3">{feature.title}</h3>
                  <p className="text-neutral-600 leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-neutral-900 mb-6">Try the Demo</h2>
          <p className="text-center text-neutral-600 text-lg mb-12 max-w-2xl mx-auto">
            Explore a fully functional Synapse OS environment with realistic patient data. No sign-up, no dummy accounts—just a clean, sandboxed clinical workspace.
          </p>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Link to="/demo/doctor">
              <motion.div
                whileHover={{ y: -8 }}
                className="card-interactive p-12 bg-gradient-to-br from-green-50 to-white group"
              >
                <Activity className="w-12 h-12 text-green-600 mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-bold text-neutral-900 mb-4">Doctor Queue</h3>
                <p className="text-neutral-600 mb-8 leading-relaxed">
                  View the OPD patient queue sorted by acuity. Click on any patient to open their encounter and experience the full clinical workflow.
                </p>
                <div className="flex items-center gap-2 text-green-600 font-bold uppercase text-sm">
                  Open Dashboard <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            </Link>

            <motion.div
              whileHover={{ y: -8 }}
              className="card-interactive p-12 bg-gradient-to-br from-neutral-100 to-white opacity-60 relative overflow-hidden group cursor-not-allowed"
            >
              <div className="absolute top-6 right-6 px-3 py-1 bg-neutral-200 rounded-full text-[10px] font-bold uppercase tracking-widest">Coming Soon</div>
              <Beaker className="w-12 h-12 text-neutral-400 mb-6" />
              <h3 className="text-2xl font-bold text-neutral-700 mb-4">Pharmacy Module</h3>
              <p className="text-neutral-500 mb-8 leading-relaxed">
                Dispense medications, check interactions, manage inventory, and handle insurance coverage calculations.
              </p>
            </motion.div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 flex gap-4">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-bold text-neutral-900 mb-2">Demo Credentials</p>
              <p className="text-neutral-600 text-sm">
                Use <code className="bg-blue-100 px-2 py-1 rounded">demo@synapseos.tech</code> / <code className="bg-blue-100 px-2 py-1 rounded">Demo4321</code> to access the full platform demo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Synapse Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-green-50 to-emerald-50 border-t border-neutral-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-neutral-900 mb-16">Why Synapse?</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: CheckCircle,
                title: 'Built for Africa',
                description: 'Designed specifically for low-resource settings with offline-first architecture and minimal bandwidth requirements.',
              },
              {
                icon: Shield,
                title: 'Privacy First',
                description: 'All patient data encrypted, HIPAA-compliant, and auditable. No third-party data sharing ever.',
              },
              {
                icon: TrendingUp,
                title: 'Outcomes Focused',
                description: 'Measurable improvements in diagnostic accuracy, treatment adherence, and patient outcomes.',
              },
              {
                icon: Clock,
                title: '24/7 Availability',
                description: 'Works offline, syncs when connected. No downtime. No excuses.',
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex gap-6"
                >
                  <Icon className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-neutral-900 mb-2">{item.title}</h3>
                    <p className="text-neutral-600">{item.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-neutral-900 mb-6">Ready for Pilot?</h2>
          <p className="text-neutral-600 text-lg mb-12">
            Join leading health facilities transforming care with Synapse.
          </p>
          <Link to="/apply" className="btn-primary inline-flex items-center gap-2 text-lg py-4 px-10">
            Request Pilot Access
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <Link to="/" className="inline-block mb-4 group">
                <SynapseLogo variant="light" className="text-neutral-900 group-hover:opacity-80 transition-opacity" />
              </Link>
              <p className="text-sm text-neutral-600">Sovereign AI health operating system for Africa.</p>
            </div>
            <div>
              <p className="font-bold text-neutral-900 mb-4">Product</p>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li><a href="#features" className="hover:text-green-600 transition">Features</a></li>
                <li><a href="#demo" className="hover:text-green-600 transition">Demo</a></li>
                <li><Link to="/pricing" className="hover:text-green-600 transition">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-neutral-900 mb-4">Company</p>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li><a href="#" className="hover:text-green-600 transition">About</a></li>
                <li><a href="#" className="hover:text-green-600 transition">Blog</a></li>
                <li><a href="#" className="hover:text-green-600 transition">Careers</a></li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-neutral-900 mb-4">Legal</p>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li><Link to="/legal/privacy" className="hover:text-green-600 transition">Privacy</Link></li>
                <li><Link to="/legal/terms" className="hover:text-green-600 transition">Terms</Link></li>
                <li><a href="#" className="hover:text-green-600 transition">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-200 pt-8">
            <p className="text-center text-sm text-neutral-600">
              © 2026 Synapse. All rights reserved. Built with ❤️ for Africa.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
