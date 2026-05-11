import React from 'react';
import { motion } from 'motion/react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Calendar, Clock, User, Video, Download, ArrowRight, Mail, Smartphone } from 'lucide-react';
import { Logo } from '../../components/Logo';

export default function TeleBooked() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const doctorName = searchParams.get('name') || 'Dr. Sarah Okello';
  const time = searchParams.get('time') || '10:30 AM';

  return (
    <div className="min-h-screen bg-synapse-black text-white selection:bg-synapse-primary/30 flex flex-col">
      <nav className="h-16 border-b border-white/5 bg-synapse-black/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <Logo size="sm" />
      </nav>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-xl w-full text-center"
        >
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-10 border border-emerald-500/30">
             <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>

          <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Appointment Confirmed!</h1>
          <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest mb-12">Booking ID: {id?.toUpperCase()}</p>

          <div className="card p-8 bg-synapse-dark border-white/10 mb-12 space-y-6 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
               <Calendar className="w-20 h-20" />
            </div>
            <div className="grid gap-6 relative z-10">
              <div className="flex items-center gap-4">
                 <Calendar className="w-5 h-5 text-synapse-primary" />
                 <span className="text-sm font-black uppercase tracking-tight">Monday, 28 April 2026</span>
              </div>
              <div className="flex items-center gap-4">
                 <Clock className="w-5 h-5 text-synapse-primary" />
                 <span className="text-sm font-black uppercase tracking-tight">{time}</span>
              </div>
              <div className="flex items-center gap-4">
                 <User className="w-5 h-5 text-synapse-primary" />
                 <span className="text-sm font-black uppercase tracking-tight">{doctorName}</span>
              </div>
              <div className="flex items-center gap-4">
                 <Video className="w-5 h-5 text-synapse-primary" />
                 <span className="text-sm font-black uppercase tracking-tight">Video Consultation</span>
              </div>
            </div>
            <div className="pt-6 border-t border-white/5">
               <div className="flex items-start gap-3 bg-synapse-primary/5 p-4 rounded-xl border border-synapse-primary/20">
                  <Info className="w-4 h-4 text-synapse-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] font-bold text-neutral-400 uppercase leading-relaxed tracking-tight">
                    The consultation room link will be active 5 minutes before your appointment. You will receive an SMS reminder.
                  </p>
               </div>
            </div>
          </div>

          <div className="space-y-4">
             <Link to={`/tele/room/${id}`} className="btn-primary w-full py-5 flex items-center justify-center gap-3 text-sm">
                JOIN CONSULTATION ROOM <ArrowRight className="w-4 h-4" />
             </Link>
             <div className="grid grid-cols-2 gap-4">
                <button className="btn-secondary py-4 text-[10px] flex items-center justify-center gap-2">
                   <Download className="w-3.5 h-3.5" /> ADD TO CALENDAR
                </button>
                <button className="btn-secondary py-4 text-[10px] flex items-center justify-center gap-2">
                   <Smartphone className="w-3.5 h-3.5" /> DOWNLOAD APP
                </button>
             </div>
          </div>

          <p className="mt-12 text-center text-mono-xs text-neutral-700">
            Need to reschedule? <a href="mailto:founder@synapseos.tech" className="text-synapse-primary hover:underline underline-offset-4">Contact us</a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function Info(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
