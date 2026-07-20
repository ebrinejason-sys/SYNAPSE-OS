import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { SynapseLogo } from '../../components/ui/SynapseLogo';

export default function SimplePage() {
  const location = useLocation();
  const title = location.pathname.split('/').pop()?.replace(/-/g, ' ') || 'Page';

  return (
    <div className="min-h-screen bg-ink text-text-1">
      <nav className="fixed top-0 w-full z-50 bg-ink/80 backdrop-blur-md border-b border-edge h-16 flex items-center px-6 lg:px-12">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <SynapseLogo />
        </Link>
      </nav>

      <div className="pt-40 pb-20 px-6 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link to="/" className="label-xs hover:text-gold transition-colors mb-8 inline-flex items-center gap-2 group">
            <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to Home
          </Link>
          <h1 className="heading-1 uppercase mb-12 text-gold-gradient">{title}</h1>

          <div className="space-y-8 text-text-3 font-medium leading-relaxed">
            <p className="text-lg">This page is currently under construction as we finalize our Version 2.0 release documents.</p>
            <div className="card p-8">
              <p className="text-sm text-text-2">Synapse OS is the sovereign AI health operating system for Africa. We are building the clinical intelligence infrastructure that will close the healthcare gap for millions.</p>
            </div>
            <p>Please check back soon for updated documentation, company manifestos, and legal protocols.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
