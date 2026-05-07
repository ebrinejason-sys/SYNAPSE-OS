import { motion } from 'motion/react';
import { Activity, ChevronLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function SimplePage() {
  const location = useLocation();
  const title = location.pathname.split('/').pop()?.replace(/-/g, ' ') || 'Page';

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

      <div className="pt-40 pb-20 px-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/" className="text-mono-xs text-neutral-600 hover:text-synapse-primary transition-colors mb-8 inline-flex items-center gap-2 group">
            <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> BACK TO HOME
          </Link>
          <h1 className="heading-huge uppercase mb-12 text-gradient">{title}</h1>

          <div className="space-y-8 text-neutral-400 font-medium leading-relaxed">
            <p className="text-lg">This page is currently under construction as we finalize our Version 2.0 release documents.</p>
            <div className="p-8 border border-white/5 bg-white/5 rounded-2xl">
              <p className="text-sm">Synapse OS is the sovereign AI health operating system for Africa. We are building the clinical intelligence infrastructure that will close the healthcare gap for millions.</p>
            </div>
            <p>Please check back soon for updated documentation, company manifestos, and legal protocols.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
