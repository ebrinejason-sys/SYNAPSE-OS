import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SynapseIcon } from '../../components/ui/SynapseLogo';

export default function Login() {
  return (
    <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-gray-50 to-green-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50"
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
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              <input 
                type="password" 
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/20 text-gray-700 font-medium transition-all"
                defaultValue="SynapseDemo2026"
              />
            </div>
          </div>

          <button className="w-full py-5 bg-[#0F172A] text-white rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all shadow-xl shadow-gray-900/10 flex items-center justify-center gap-3">
            Sign In <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-gray-50 text-center">
          <p className="text-gray-400 text-sm mb-4">Don't have an instance yet?</p>
          <Link to="/apply" className="text-green-600 font-bold hover:text-green-700 transition-colors flex items-center justify-center gap-2">
            Apply for Pilot Access <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
           <ShieldCheck className="w-4 h-4" /> HIPAA & GDPR Compliant Backend
        </div>
      </motion.div>
    </div>
  );
}
