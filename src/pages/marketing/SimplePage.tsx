import { motion } from 'motion/react';
import { Activity, ChevronLeft, Linkedin, Mail } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function SimplePage() {
  const location = useLocation();
  const path = location.pathname;
  const title = path.split('/').pop()?.replace(/-/g, ' ') || 'Page';

  const isAbout = path === '/about';

  return (
    <div className="min-h-screen bg-synapse-black text-white font-sans selection:bg-synapse-primary/30 selection:text-cyan-200">
      <nav className="fixed top-0 w-full z-50 bg-synapse-black/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between px-6 lg:px-12">
        <Link to="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="w-8 h-8 bg-synapse-primary rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 shadow-lg shadow-cyan-500/20">
            <Activity className="w-5 h-5 text-synapse-black" />
          </div>
          <span className="font-black text-xl tracking-tighter text-white uppercase">Synapse<span className="text-synapse-primary">OS</span></span>
        </Link>
      </nav>

      <div className="pt-40 pb-20 px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/" className="text-mono-xs text-neutral-600 hover:text-synapse-primary transition-colors mb-8 inline-flex items-center gap-2 group">
            <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> BACK TO HOME
          </Link>
          <h1 className="heading-huge uppercase mb-12 text-gradient">{title}</h1>

          {isAbout ? (
            <div className="space-y-20">
              <section className="space-y-8 text-neutral-400 font-medium leading-relaxed">
                <p className="text-xl text-white font-bold">Synapse Health Technologies Ltd is a two-product sovereign AI health ecosystem built in Uganda for Africa and the world.</p>
                <p>We address a structural failure in African healthcare: the complete absence of intelligent, connected, offline-capable clinical infrastructure at the point of care.</p>
                <div className="p-8 border border-white/5 bg-white/5 rounded-2xl">
                  <p className="text-sm">Our mission is to close the gap between patient needs and clinical capacity by giving every doctor exponentially better tools, and every patient a permanent connection to their care team.</p>
                </div>
              </section>

              <section>
                <h2 className="text-mono-xs text-synapse-primary mb-12 uppercase tracking-widest">The Founders</h2>
                <div className="grid md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-synapse-primary to-blue-700 flex items-center justify-center text-4xl font-black text-white shadow-2xl">JT</div>
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight">Jason Ebrine Tushabe</h3>
                      <p className="text-mono-xs text-synapse-primary font-black mt-1">CO-FOUNDER & CEO / CTO</p>
                    </div>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                      Health informatician and self-taught software engineer. Built Habakkuk, a pharmacy management system deployed across Uganda. Conducted facility assessments at 40+ health centres for Uganda's Ministry of Health. Architected the entire Synapse ecosystem and built the MVP using Claude Code. Passionate about using technology to close healthcare gaps in Africa.
                    </p>
                    <div className="flex gap-4">
                      <a href="https://www.linkedin.com/in/ebrine-tushabe-5512263ba/" className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-synapse-primary hover:text-synapse-black transition-all">
                        <Linkedin className="w-4 h-4" />
                      </a>
                      <a href="mailto:founder@synapseos.tech" className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-synapse-primary hover:text-synapse-black transition-all">
                        <Mail className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-4xl font-black text-white shadow-2xl">ND</div>
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tight">Nathan David</h3>
                      <p className="text-mono-xs text-synapse-primary font-black mt-1">CO-FOUNDER & COO</p>
                    </div>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                      Six years in healthcare financing and insurance in Uganda. Deep expertise in how hospitals win and lose revenue through insurance claim management. Direct relationships with National Medical Stores and three major health insurance providers. Leads business development, hospital partnerships, and regulatory engagement at Synapse.
                    </p>
                    <div className="flex gap-4">
                      <a href="#" className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-emerald-500 hover:text-synapse-black transition-all">
                        <Linkedin className="w-4 h-4" />
                      </a>
                      <a href="mailto:nathandavid762@gmail.com" className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-emerald-500 hover:text-synapse-black transition-all">
                        <Mail className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </section>

              <section id="funding" className="p-12 bg-white/5 border border-white/5 rounded-[3rem] text-center">
                 <h2 className="text-mono-xs text-synapse-primary mb-6">FUNDING & SUPPORT</h2>
                 <p className="text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                    Synapse Health Technologies is a participant in the STI-OP Funding program and is supported by national health initiatives in East Africa.
                 </p>
              </section>
            </div>
          ) : (
            <div className="space-y-8 text-neutral-400 font-medium leading-relaxed">
              <p className="text-lg">This page is currently under construction as we finalize our Version 2.0 release documents.</p>
              <div className="p-8 border border-white/5 bg-white/5 rounded-2xl">
                <p className="text-sm">Synapse OS is the sovereign AI health operating system for Africa. We are building the clinical intelligence infrastructure that will close the healthcare gap for millions.</p>
              </div>
              <p>Please check back soon for updated documentation, company manifestos, and legal protocols.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
