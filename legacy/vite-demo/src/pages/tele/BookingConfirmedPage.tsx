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
} from 'lucide-react';
import { motion } from 'motion/react';
import { SynapseLogo } from '../../components/ui/SynapseLogo';

export default function BookingConfirmedPage() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-ink text-text-1 flex flex-col">
      <header className="h-14 border-b border-edge flex items-center justify-between px-6 bg-ink/80 backdrop-blur-md sticky top-0 z-50">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <SynapseLogo />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full text-center space-y-8"
        >
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-emerald/10 border border-emerald/30 flex items-center justify-center shadow-2xl">
              <CheckCircle2 className="w-10 h-10 text-emerald" />
            </div>
            <div className="space-y-2">
              <h1 className="heading-2">Appointment Confirmed!</h1>
              <p className="text-text-3 font-medium">
                Your booking ID: <span className="font-mono text-gold text-xs">{id}</span>
              </p>
            </div>
          </div>

          <div className="card-elevated p-8 text-left space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <CheckCircle2 className="w-32 h-32 text-gold" />
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="label-xs flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> Date
                </p>
                <p className="font-mono text-sm font-bold text-text-1 uppercase">28 April 2026</p>
              </div>
              <div className="space-y-1">
                <p className="label-xs flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Time
                </p>
                <p className="font-mono text-sm font-bold text-text-1 uppercase">10:30 AM</p>
              </div>
              <div className="space-y-1">
                <p className="label-xs flex items-center gap-2">
                  <User className="w-3 h-3" /> Doctor
                </p>
                <p className="text-sm font-bold text-text-1">Dr. Sarah Okello</p>
              </div>
              <div className="space-y-1">
                <p className="label-xs flex items-center gap-2">
                  <Video className="w-3 h-3" /> Platform
                </p>
                <p className="text-sm font-bold text-text-1">Video Consultation</p>
              </div>
            </div>

            <div className="p-4 bg-gold/5 border border-gold/20 rounded-xl space-y-2">
              <p className="label-xs text-gold">Joining instructions</p>
              <p className="text-[11px] text-text-3 font-medium leading-relaxed">
                The video room link will become active 5 minutes before your scheduled time. You will receive a reminder via SMS.
              </p>
            </div>

            <Link to={`/tele/room/${id}`} className="btn-primary w-full py-4 text-xs flex items-center justify-center gap-2 group">
              Enter Consultation Room <ExternalLink className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-6">
            <h3 className="label-sm">What happens next:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: "SMS Confirmation", desc: "You'll receive a confirmation code shortly." },
                { title: "Reminders", desc: "A reminder 30 mins before your appointment." },
                { title: "Join Call", desc: "Come back here and click \"Enter Room\"." }
              ].map((step, i) => (
                <div key={i} className="card p-4 text-left space-y-2">
                  <p className="label-xs text-gold">{i + 1}. {step.title}</p>
                  <p className="text-[10px] text-text-3 font-bold leading-tight uppercase tracking-tight">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 pt-4">
            <button type="button" className="btn-secondary flex-1 py-4 text-[10px] gap-2 flex items-center justify-center">
              <Calendar className="w-4 h-4" /> Add to Calendar
            </button>
            <button type="button" className="btn-secondary flex-1 py-4 text-[10px] gap-2 flex items-center justify-center">
              <Download className="w-4 h-4" /> Download Synapse App
            </button>
          </div>

          <p className="label-xs pt-4">
            Need to reschedule?{' '}
            <a href="mailto:founder@synapseos.tech" className="text-gold hover:underline">
              Contact Support
            </a>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
