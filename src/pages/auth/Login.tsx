import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SynapseIcon } from '../../components/ui/SynapseLogo';

export default function Login() {
  return (
    <div className="min-h-screen bg-synapse-black text-white font-sans flex items-center justify-center p-6 selection:bg-synapse-primary/30 selection:text-cyan-200">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-synapse-primary to-transparent opacity-20" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <SynapseIcon size={64} className="mx-auto mb-6 shadow-xl" />
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <span className="font-black text-2xl tracking-tighter uppercase">Synapse<span className="text-synapse-primary">OS</span></span>
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Welcome Back</h1>
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Sign in to your clinical workspace</p>
        </div>

        <div className="card p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-mono-xs text-neutral-600 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  type="email"
                  placeholder="name@facility.com"
                  defaultValue="demo@synapseos.tech"
                  className="input pl-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-mono-xs text-neutral-600">Password</label>
                <button className="text-[10px] font-bold text-synapse-primary uppercase tracking-widest hover:underline">Forgot?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  type="password"
                  placeholder="••••••••"
                  defaultValue="Demo4321"
                  className="input pl-11"
                />
              </div>
            </div>
          </div>

          <button
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 group"
            onClick={() => { window.location.href = '/demo/doctor'; }}
          >
            Sign In to Workspace <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>

          <div className="flex items-center gap-3 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-synapse-primary shrink-0" />
            Demo mode — no real patient data
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
          New to Synapse?{' '}
          <Link to="/signup" className="text-synapse-primary hover:underline">Apply for pilot access</Link>
        </p>
      </motion.div>
    </div>
  );
}
