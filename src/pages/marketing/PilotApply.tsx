import { motion } from 'motion/react';
import { Send, CheckCircle, Hospital, MapPin, Smartphone, User } from 'lucide-react';
import { useState } from 'react';

export default function PilotApply() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-8">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Application Received</h1>
          <p className="text-gray-500 max-w-md mx-auto mb-8">
            Thank you for your interest in the Synapse Pilot Program. Our implementation team will contact you within 48 hours to schedule a facility site visit.
          </p>
          <button onClick={() => window.location.href = '/'} className="px-8 py-3 bg-[#0F172A] text-white rounded-xl font-bold">Return Home</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-16">
          <h1 className="text-4xl font-bold text-[#0F172A] mb-4">Apply for Pilot Access</h1>
          <p className="text-gray-500">Scale your clinical intelligence with Synapse OS. Now accepting 20 new facilities for Q3 2026.</p>
        </header>

        <form className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}>
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Facility Name</label>
              <div className="relative">
                <Hospital className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input type="text" required placeholder="Mengo Hospital" className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/20" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">District</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input type="text" required placeholder="Kampala" className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/20" />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contact Person</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                  <input type="text" required placeholder="Admin Name" className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Phone Number</label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                  <input type="tel" required placeholder="+256..." className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                </div>
              </div>
          </div>

          <div className="space-y-2 mb-10">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Facility Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm font-bold">
               {['Public HCIV', 'Private Clinic', 'Hospital', 'NGO Center'].map(type => (
                 <label key={type} className="flex items-center gap-2 p-4 border border-gray-100 rounded-xl cursor-pointer hover:bg-green-50 transition-colors">
                    <input type="radio" name="facType" value={type} className="accent-green-600" />
                    {type}
                 </label>
               ))}
            </div>
          </div>

          <button className="w-full py-5 bg-green-600 text-white rounded-2xl font-bold text-lg hover:bg-green-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-green-600/20">
            Submit Application <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
