import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Video,
  ExternalLink,
  Download,
  Mail,
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';

export default function BookingConfirmedPage() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-synapse-black text-white font-sans flex flex-col">
      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full text-center space-y-8"
        >
          <div className="flex flex-col items-center gap-6">
             <div className="w-20 h-20 rounded-full bg-synapse-emerald/10 border border-synapse-emerald/20 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 text-synapse-emerald" />
             </div>
             <div className="space-y-2">
                <h1 className="heading-2">Appointment Confirmed!</h1>
                <p className="text-neutral-500 font-medium tracking-tight">Your booking ID: <span className="text-mono-xs text-synapse-primary">{id}</span></p>
             </div>
          </div>

          <div className="card p-8 text-left space-y-6 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity className="w-32 h-32 text-synapse-primary" />
             </div>

             <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> Date
                   </p>
                   <p className="font-mono text-sm font-bold text-white uppercase">28 April 2026</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Time
                   </p>
                   <p className="font-mono text-sm font-bold text-white uppercase">10:30 AM</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <User className="w-3 h-3" /> Doctor
                   </p>
                   <p className="text-sm font-bold text-white">Dr. Sarah Okello</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <Video className="w-3 h-3" /> Platform
                   </p>
                   <p className="text-sm font-bold text-white">Video Consultation</p>
                </div>
             </div>

             <div className="p-4 bg-synapse-primary/5 border border-synapse-primary/10 rounded-xl space-y-2">
                <p className="text-[10px] font-black text-synapse-primary uppercase tracking-widest">Joining instructions</p>
                <p className="text-[11px] text-neutral-400 font-medium leading-relaxed">
                  The video room link will become active 5 minutes before your scheduled time. You will receive a reminder via SMS.
                </p>
             </div>

             <Link to={`/tele/room/${id}`} className="btn-primary w-full py-4 text-xs flex items-center justify-center gap-2 group">
                Enter Consultation Room <ExternalLink className="w-4 h-4" />
             </Link>
          </div>

          <div className="space-y-6">
             <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">What happens next:</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: "SMS Confirmation", desc: "You'll receive a confirmation code shortly." },
                  { title: "Reminders", desc: "A reminder 30 mins before your appointment." },
                  { title: "Join Call", desc: "Come back here and click \"Enter Room\"." }
                ].map((step, i) => (
                  <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/5 text-left space-y-2">
                     <p className="text-[10px] font-black text-synapse-primary uppercase tracking-widest">{i + 1}. {step.title}</p>
                     <p className="text-[10px] text-neutral-500 font-bold leading-tight uppercase tracking-tight">{step.desc}</p>
                  </div>
                ))}
             </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 pt-8">
             <button className="btn-secondary flex-1 py-4 text-[10px] gap-2 flex items-center justify-center">
                <Calendar className="w-4 h-4" /> Add to Calendar
             </button>
             <button className="btn-secondary flex-1 py-4 text-[10px] gap-2 flex items-center justify-center">
                <Download className="w-4 h-4" /> Download Synapse App
             </button>
          </div>

          <p className="text-[10px] font-bold text-neutral-700 uppercase tracking-widest pt-8">
             Need to reschedule? <a href="mailto:founder@synapseos.tech" className="text-synapse-primary hover:underline">Contact Support</a>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
