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
          <h1 className="text-3xl font-bold text-[#0F172A] mb-2">Welcome Back</h1>
          <p className="text-gray-500 text-sm font-medium">Professional clinical login</p>
        </div>

        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); window.location.href = '/demo/doctor'; }}>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Work Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              <input 
                type="email" 
                placeholder="dr.okello@mengo.org"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/20 text-gray-700 font-medium transition-all"
                defaultValue="demo@synapseos.health"
              />
            </div>
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
                  className="input pl-11"
                />
              </div>
            </div>
          </div>

          <button className="btn-primary w-full py-4 flex items-center justify-center gap-2 group">
            Sign In to Workspace <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
              <span className="bg-synapse-dark px-4 text-neutral-600">Or continue with</span>
            </div>
          </div>

          <button className="btn-secondary w-full py-4 flex items-center justify-center gap-2">
            <Github className="w-4 h-4" /> Provider SSO
          </button>
        </div>

        <p className="mt-8 text-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
          New to Synapse? <Link to="/signup" className="text-synapse-primary hover:underline">Apply for pilot access</Link>
        </p>
      </motion.div>
    </div>
  );
}
