import { motion } from 'motion/react';
import { Mail, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SynapseIcon } from '../../components/ui/SynapseLogo';

export default function SignUp() {
  return (
    <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-white via-gray-50 to-blue-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-2xl"
      >
        <div className="text-center mb-10">
          <SynapseIcon size={64} className="mx-auto mb-6 shadow-xl" />
          <h1 className="text-3xl font-bold text-[#0F172A] mb-2">Create Account</h1>
          <p className="text-gray-500 text-sm font-medium">Join the Synapse Ecosystem</p>
        </div>

        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mb-8">
           <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-widest mb-3">
              <CheckCircle2 className="w-4 h-4" /> Professional Verify
           </div>
           <p className="text-xs text-blue-900 leading-relaxed font-medium">
             Accounts are restricted to verified healthcare professionals. You will need your medical council registration number during onboarding.
           </p>
        </div>

        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">First Name</label>
                <input type="text" placeholder="John" className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/20" />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Last Name</label>
                <input type="text" placeholder="Okello" className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/20" />
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Work Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              <input type="email" placeholder="doctor@hospital.org" className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/20" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              <input type="password" placeholder="••••••••" className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/20" />
            </div>
          </div>

          <button className="w-full py-5 bg-[#0F172A] text-white rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-3">
             Create My Account <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          Already a partner? <Link to="/login" className="text-green-600 font-bold">Sign In</Link>
        </p>
      </motion.div>
    </div>
  );
}
