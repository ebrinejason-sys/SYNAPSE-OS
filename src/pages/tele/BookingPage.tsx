import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  ShieldCheck,
  Video,
  CreditCard,
  ChevronRight,
  Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function BookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const triage = searchParams.get('triage') || 'routine';
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate booking
    const appointmentId = Math.random().toString(36).substring(2, 15);
    navigate(`/tele/booked/${appointmentId}`);
  };

  return (
    <div className="min-h-screen bg-synapse-black text-white font-sans">
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-50 bg-synapse-black/80 backdrop-blur-md">
        <Link to="/tele" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Triage</span>
        </Link>
        <span className="text-[10px] font-black uppercase tracking-widest">Book Appointment</span>
        <div className="w-4 h-4" /> {/* Spacer */}
      </header>

      <main className="max-w-3xl mx-auto p-6 md:p-12 space-y-12">
        <div className="space-y-4">
           <h2 className="heading-2">Finalize your <span className="text-synapse-primary">consultation.</span></h2>
           <p className="text-neutral-500 font-medium">Please confirm your details and appointment slot below.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
           {/* Appointment Summary */}
           <div className="space-y-6">
              <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Appointment Summary</h3>
              <div className="card p-6 space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-synapse-primary/10 border border-synapse-primary/20 flex items-center justify-center">
                       <User className="w-6 h-6 text-synapse-primary" />
                    </div>
                    <div>
                       <p className="text-sm font-bold text-white">Dr. Sarah Okello</p>
                       <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">General Medicine</p>
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-3 text-xs font-bold text-neutral-300">
                       <Calendar className="w-4 h-4 text-synapse-primary" />
                       Monday, 28 April 2026
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-neutral-300">
                       <Clock className="w-4 h-4 text-synapse-primary" />
                       10:30 AM (20 mins)
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-neutral-300">
                       <Video className="w-4 h-4 text-synapse-primary" />
                       Video Consultation (LiveKit)
                    </div>
                 </div>

                 <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Consultation Fee</div>
                    <div className="text-lg font-black text-synapse-primary">UGX 30,000</div>
                 </div>

                 <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Insurance: Not applied (pay cash)</span>
                 </div>
              </div>
           </div>

           {/* Details Form */}
           <div className="space-y-6">
              <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Your Details</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Full Name</label>
                    <input
                      required
                      className="input"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Phone Number (Required for SMS)</label>
                    <div className="relative">
                       <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                       <input
                         required
                         className="input pl-12"
                         placeholder="+256..."
                         type="tel"
                         value={formData.phone}
                         onChange={e => setFormData({...formData, phone: e.target.value})}
                       />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Email (Optional for calendar invite)</label>
                    <input
                      className="input"
                      placeholder="name@example.com"
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Notes for the Doctor (Optional)</label>
                    <textarea
                      className="input min-h-[100px] py-4"
                      placeholder="Describe any specifics about your symptoms..."
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                 </div>

                 <button type="submit" className="btn-primary w-full py-5 text-sm shadow-2xl shadow-cyan-500/30 group">
                    Confirm Booking <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform inline" />
                 </button>

                 <p className="text-[9px] text-neutral-600 font-bold text-center uppercase tracking-widest pt-4">
                   By booking, you agree to our <Link to="/terms" className="text-synapse-primary hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-synapse-primary hover:underline">Privacy Policy</Link>.
                 </p>
              </form>
           </div>
        </div>
      </main>

      <footer className="py-20 border-t border-white/5 px-6">
         <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
               <Activity className="w-4 h-4 text-synapse-primary" />
               <span className="text-[10px] font-black text-white uppercase tracking-widest">SynapseOS <span className="text-neutral-500">Telemedicine</span></span>
            </div>
            <p className="text-[10px] font-bold text-neutral-700 uppercase tracking-widest">© 2026 Synapse Ecosystem</p>
         </div>
      </footer>
    </div>
  );
}
