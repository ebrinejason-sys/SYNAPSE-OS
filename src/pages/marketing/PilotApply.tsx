import { motion } from 'motion/react';
import { Activity, Mail, Building, MapPin, Users, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PilotApply() {
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

      <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-16">
            <h1 className="heading-1 mb-4 uppercase tracking-tight">Pilot Application</h1>
            <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest max-w-xl mx-auto">Join the cohort of forward-thinking healthcare facilities building the future of African clinical intelligence.</p>
          </div>

          <div className="card p-10 md:p-16 space-y-10">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-mono-xs text-neutral-600">Facility Name</label>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                  <input type="text" className="input pl-11" placeholder="e.g. Mengo Hospital" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-mono-xs text-neutral-600">Location / City</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                  <input type="text" className="input pl-11" placeholder="e.g. Kampala, Uganda" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-mono-xs text-neutral-600">Facility Type</label>
                <select className="input appearance-none">
                  <option className="bg-synapse-dark">General Hospital</option>
                  <option className="bg-synapse-dark">Private Clinic</option>
                  <option className="bg-synapse-dark">Health Center IV</option>
                  <option className="bg-synapse-dark">Specialized Center</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-mono-xs text-neutral-600">Number of Staff</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                  <input type="text" className="input pl-11" placeholder="e.g. 50-100" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-mono-xs text-neutral-600">What is your biggest operational challenge?</label>
              <textarea className="input min-h-[120px] resize-none" placeholder="Describe how Synapse OS can help your facility..." />
            </div>

            <button className="btn-primary w-full py-5 flex items-center justify-center gap-3 text-sm">
              <Send className="w-4 h-4" /> SUBMIT APPLICATION
            </button>
          </div>

          <p className="mt-12 text-center text-mono-xs text-neutral-700">
            Our team will review your application and respond within 2 business days.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
