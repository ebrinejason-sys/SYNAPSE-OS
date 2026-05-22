import { motion } from 'motion/react';
import { Mail, User, Building, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SynapseIcon } from '../../components/ui/SynapseLogo';

export default function SignUp() {
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
          <h1 className="font-display text-3xl font-black uppercase tracking-tight mb-2">Join the Pilot</h1>
          <p className="label-xs">Request access for your hospital or clinic</p>
        </div>

        <div className="card p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="label-xs ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                <input type="text" placeholder="Dr. Jane Doe" className="input pl-11" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="label-xs ml-1">Facility Name</label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                <input type="text" placeholder="Mengo Hospital" className="input pl-11" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="label-xs ml-1">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                <input type="email" placeholder="jane@facility.com" className="input pl-11" />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-4 flex items-center justify-center gap-2 group">
            Submit Application
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-gold/5 border border-gold/20">
            <CheckCircle2 className="w-4 h-4 text-gold shrink-0 mt-0.5" />
            <p className="text-xs text-text-2 leading-relaxed">
              We review all applications within 48 hours. You'll receive a custom subdomain
              for your facility on approval.
            </p>
          </div>
        </div>

        <p className="mt-8 text-center label-xs">
          Already have access?{' '}
          <Link to="/login" className="text-gold hover:underline">Sign In</Link>
        </p>
      </motion.div>
    </div>
  );
}
