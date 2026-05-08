import React from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft, ExternalLink, Mail, Linkedin } from 'lucide-react';
import { Logo } from '../../components/Logo';

export default function SimplePage() {
  const isAboutPage = window.location.pathname === '/about';

  return (
    <div className="min-h-screen bg-synapse-black text-white selection:bg-synapse-primary/30 selection:text-cyan-200">
      <nav className="fixed top-0 w-full z-50 bg-synapse-black/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between px-6 lg:px-12">
        <Logo size="sm" />
        <Link to="/" className="text-mono-xs text-neutral-500 hover:text-white flex items-center gap-2">
          <ArrowLeft className="w-3 h-3" /> Back to Home
        </Link>
      </nav>

      <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {isAboutPage ? (
            <div className="space-y-20">
              <section>
                <div className="text-mono-xs text-synapse-primary mb-6">Our Mission</div>
                <h1 className="heading-huge uppercase mb-12">Sovereign Intelligence <br /> <span className="text-neutral-500">for Global Health.</span></h1>
                <p className="text-xl font-bold text-neutral-400 leading-relaxed mb-8">
                  Synapse was born from a structural failure in African healthcare: the complete absence of intelligent, connected, offline-capable clinical infrastructure at the point of care.
                </p>
                <div className="grid grid-cols-2 gap-8 py-12 border-y border-white/5">
                   <div>
                      <div className="text-3xl font-black text-synapse-primary mb-2">1:25,000</div>
                      <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Doctor-Patient Ratio in Uganda</p>
                   </div>
                   <div>
                      <div className="text-3xl font-black text-synapse-primary mb-2">40%</div>
                      <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Revenue Leakage in Insurance</p>
                   </div>
                </div>
              </section>

              <section id="team">
                <div className="text-mono-xs text-synapse-primary mb-12">Leadership</div>
                <div className="grid gap-12">
                   <div className="flex flex-col md:flex-row gap-8 items-start card p-10">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden shrink-0 border border-white/10">
                         <img src="/assets/team/tushabe-ebrine.png" alt="Jason Ebrine Tushabe" className="w-full h-full object-cover" />
                      </div>
                      <div>
                         <h3 className="text-2xl font-black uppercase mb-1">Jason Ebrine Tushabe</h3>
                         <div className="text-mono-xs text-synapse-primary mb-6">Co-Founder & CEO / CTO</div>
                         <p className="text-neutral-400 text-sm leading-relaxed mb-8">
                            Health informatician and self-taught software engineer. Built Habakkuk, a pharmacy management system deployed across Uganda. Conducted facility assessments at 40+ health centres for Uganda's Ministry of Health. Architected the entire Synapse ecosystem.
                         </p>
                         <div className="flex gap-4">
                            <a href="https://www.linkedin.com/in/ebrine-tushabe-5512263ba/" className="text-neutral-500 hover:text-white transition-colors"><Linkedin className="w-5 h-5" /></a>
                            <a href="mailto:founder@synapseos.tech" className="text-neutral-500 hover:text-white transition-colors"><Mail className="w-5 h-5" /></a>
                         </div>
                      </div>
                   </div>

                   <div className="flex flex-col md:flex-row gap-8 items-start card p-10">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden shrink-0 border border-white/10">
                         <img src="/assets/team/nathan-david.jpg" alt="Nathan David" className="w-full h-full object-cover" />
                      </div>
                      <div>
                         <h3 className="text-2xl font-black uppercase mb-1">Nathan David</h3>
                         <div className="text-mono-xs text-synapse-primary mb-6">Co-Founder & COO</div>
                         <p className="text-neutral-400 text-sm leading-relaxed mb-8">
                            Six years in healthcare financing and insurance in Uganda. Deep expertise in how hospitals win and lose revenue through insurance claim management. Leads business development, hospital partnerships, and regulatory engagement at Synapse.
                         </p>
                         <div className="flex gap-4">
                            <a href="#" className="text-neutral-500 hover:text-white transition-colors"><Linkedin className="w-5 h-5" /></a>
                            <a href="mailto:nathandavid762@gmail.com" className="text-neutral-500 hover:text-white transition-colors"><Mail className="w-5 h-5" /></a>
                         </div>
                      </div>
                   </div>
                </div>
              </section>

              <section className="bg-synapse-primary text-synapse-black p-16 rounded-[3rem]">
                <h2 className="text-4xl font-black uppercase mb-6 tracking-tighter">Ready to join the future?</h2>
                <p className="text-lg font-bold mb-10 opacity-70">We're currently selecting facilities for our Q2 2026 pilot cohort. Apply today to secure your spot.</p>
                <Link to="/apply" className="bg-synapse-black text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest inline-block hover:scale-105 transition-transform shadow-2xl">Apply for Access</Link>
              </section>
            </div>
          ) : (
            <div>
              <div className="text-mono-xs text-synapse-primary mb-6">Information Hub</div>
              <h1 className="text-5xl font-black uppercase mb-8 tracking-tighter">Under <br /> <span className="text-neutral-500">Construction.</span></h1>
              <p className="text-neutral-400 text-lg leading-relaxed mb-12">
                This page ({window.location.pathname}) is part of the Synapse OS Ecosystem v9.0 and is currently being updated with the latest clinical data and documentation.
              </p>
              <div className="card p-10 bg-white/5 border-dashed border-white/10 flex flex-col items-center text-center">
                 <div className="w-16 h-16 rounded-full bg-synapse-primary/10 flex items-center justify-center mb-6">
                    <Activity className="w-8 h-8 text-synapse-primary animate-pulse" />
                 </div>
                 <h2 className="text-xl font-black uppercase mb-4">Route Verified: HTTP 200</h2>
                 <p className="text-sm text-neutral-500 max-w-xs mb-8">The system architecture for this module is live. Full content integration is scheduled for Phase 3.</p>
                 <Link to="/" className="btn-secondary w-full">Return Home</Link>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
