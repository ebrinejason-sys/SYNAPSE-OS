import { motion } from 'motion/react';
import { Activity, Mail, User, Building, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SignUp() {
  return (
    <div className="min-h-screen bg-synapse-black text-white font-sans flex items-center justify-center p-6 selection:bg-synapse-primary/30 selection:text-cyan-200">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-synapse-primary to-transparent opacity-20" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 group mb-8">
            <div className="w-10 h-10 bg-synapse-primary rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 transition-transform group-hover:scale-110">
              <Activity className="w-6 h-6 text-synapse-black" />
            </div>
            <span className="font-black text-2xl tracking-tighter uppercase">Synapse<span className="text-synapse-primary">OS</span></span>
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Join the Future</h1>
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Apply for early pilot access</p>
        </div>

        <div className="card p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-mono-xs text-neutral-600 ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  type="text"
                  placeholder="Dr. Jane Doe"
                  className="input pl-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-mono-xs text-neutral-600 ml-1">Facility Name</label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  type="text"
                  placeholder="Mengo Hospital"
                  className="input pl-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-mono-xs text-neutral-600 ml-1">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  type="email"
                  placeholder="jane@facility.com"
                  className="input pl-11"
                />
              </div>
            </div>
          </div>

          <button className="btn-primary w-full py-4 flex items-center justify-center gap-2 group">
            Submit Application <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        <p className="mt-8 text-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
          Already have an account? <Link to="/login" className="text-synapse-primary hover:underline">Sign In</Link>
        </p>
      </motion.div>
    </div>
  );
}
