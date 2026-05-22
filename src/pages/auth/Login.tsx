import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SynapseIcon } from '../../components/ui/SynapseLogo';

export default function Login() {
  return (
    <div className="min-h-screen bg-ink text-text-1 font-body flex items-center justify-center p-6">
      <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-gold/40 via-gold/10 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <SynapseIcon size={64} className="mx-auto mb-6" />
          <Link to="/" className="inline-block mb-3">
            <span className="font-display font-black text-2xl tracking-tight uppercase">
              Synapse<span className="text-gold">OS</span>
            </span>
          </Link>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight mb-2">Welcome Back</h1>
          <p className="label-xs">Sign in to your clinical workspace</p>
        </div>

        <div className="card p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="label-xs ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
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
                <label className="label-xs">Password</label>
                <button type="button" className="text-[10px] font-bold text-gold uppercase tracking-widest hover:underline">
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
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
            type="button"
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 group"
            onClick={() => { window.location.href = '/demo/doctor'; }}
          >
            Sign In to Workspace
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>

          <div className="flex items-center gap-3 label-xs">
            <ShieldCheck className="w-4 h-4 text-gold shrink-0" />
            Demo mode — no real patient data
          </div>
        </div>

        <p className="mt-8 text-center label-xs">
          New to Synapse?{' '}
          <Link to="/signup" className="text-gold hover:underline">Apply for pilot access</Link>
        </p>
      </motion.div>
    </div>
  );
}
