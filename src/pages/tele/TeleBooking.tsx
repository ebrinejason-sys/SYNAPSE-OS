import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Video, User, Phone, Mail, Send, CheckCircle } from 'lucide-react';
import { Logo } from '../../components/Logo';

export default function TeleBooking() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const doctorName = searchParams.get('name') || 'Dr. Sarah Okello';
  const time = searchParams.get('time') || '10:30 AM';

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate booking
    setTimeout(() => {
      const bookingId = Math.random().toString(36).substring(7);
      navigate(`/tele/booked/${bookingId}?name=${doctorName}&time=${time}`);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-synapse-black text-white selection:bg-synapse-primary/30 flex flex-col">
      <nav className="h-16 border-b border-white/5 bg-synapse-black/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <Link to="/tele/chatbot" className="text-neutral-500 hover:text-white flex items-center gap-2 text-mono-xs">
          <ArrowLeft className="w-4 h-4" /> Back to Triage
        </Link>
        <Logo size="sm" />
      </nav>

      <div className="flex-1 max-w-4xl mx-auto w-full pt-12 pb-20 px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-12">
            <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Book Appointment</h1>
            <p className="text-mono-xs text-neutral-500">Secure Consultation Slot</p>
          </div>

          <div className="grid lg:grid-cols-5 gap-12">
            <div className="lg:col-span-2 space-y-8">
              <div className="card p-6 bg-synapse-primary/5 border-synapse-primary/20">
                <div className="text-mono-xs text-synapse-primary mb-6">Appointment Summary</div>
                <div className="space-y-6">
                  <div className="flex gap-4">
                     <User className="w-4 h-4 text-neutral-500 mt-0.5" />
                     <div>
                        <div className="text-xs font-black uppercase tracking-tight text-white">{doctorName}</div>
                        <div className="text-[10px] text-neutral-500 font-bold uppercase">General Medicine</div>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <Calendar className="w-4 h-4 text-neutral-500 mt-0.5" />
                     <div>
                        <div className="text-xs font-black uppercase tracking-tight text-white">Monday, 28 April 2026</div>
                        <div className="text-xs font-black font-mono text-synapse-primary mt-1">{time}</div>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <Video className="w-4 h-4 text-neutral-500 mt-0.5" />
                     <div className="text-xs font-black uppercase tracking-tight text-white">Video Consultation (LiveKit)</div>
                  </div>
                  <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                     <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Consultation Fee</span>
                     <span className="text-sm font-black text-white">UGX 30,000</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <form onSubmit={handleSubmit} className="card p-8 space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-mono-xs text-neutral-600 ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                      <input
                        type="text"
                        required
                        className="input pl-11"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-mono-xs text-neutral-600 ml-1">Phone Number (Required for SMS)</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                      <input
                        type="tel"
                        required
                        className="input pl-11"
                        placeholder="+256..."
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-mono-xs text-neutral-600 ml-1">Email (Optional)</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                      <input
                        type="email"
                        className="input pl-11"
                        placeholder="name@example.com"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-mono-xs text-neutral-600 ml-1">Notes for Doctor</label>
                    <textarea
                      className="input min-h-[100px] resize-none"
                      placeholder="Any additional information..."
                      value={formData.notes}
                      onChange={e => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full py-5 flex items-center justify-center gap-3 text-sm disabled:opacity-50"
                >
                  {isLoading ? 'CONFIRMING...' : (
                    <>
                      CONFIRM BOOKING <Send className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-center text-[10px] text-neutral-500 font-medium leading-relaxed">
                  By booking, you agree to the SynapseOS Terms of Service and Privacy Policy. All clinical data is encrypted.
                </p>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
