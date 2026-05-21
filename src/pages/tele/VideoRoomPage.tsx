import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Activity,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  MessageSquare,
  PhoneOff,
  User,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight, ShieldCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function VideoRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [timer, setTimer] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    setShowSummary(true);
  };

  return (
    <div className="h-screen bg-synapse-black text-white font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-synapse-dark/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-synapse-primary" />
              <span className="font-black text-[10px] tracking-widest uppercase">Synapse <span className="text-synapse-primary">Telemedicine</span></span>
           </div>
           <div className="h-4 w-px bg-white/10" />
           <div className="flex items-center gap-2">
              <User className="w-3 h-3 text-neutral-500" />
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Dr. Sarah Okello</span>
           </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-[10px] font-bold tracking-widest">{formatTimer(timer)}</span>
           </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left: Patient Intake */}
        <div className="hidden lg:flex w-72 border-r border-white/5 flex-col bg-synapse-dark/20 p-6 space-y-8 overflow-y-auto">
           <section className="space-y-4">
              <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Patient Intake</h3>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Name</p>
                    <p className="text-sm font-bold text-white">John Ssemwanga</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Age / Sex</p>
                       <p className="text-sm font-bold text-white">28M</p>
                    </div>
                    <div className="space-y-1">
                       <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Triage</p>
                       <p className="text-xs font-black text-amber-500 uppercase tracking-widest">🟡 URGENT</p>
                    </div>
                 </div>
              </div>
           </section>

           <section className="space-y-4">
              <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Reported Symptoms</h3>
              <div className="space-y-2">
                 {['High Fever (3 days)', 'Rigors', 'Intense Headache', 'Muscle Pain'].map((s, i) => (
                   <div key={i} className="flex items-center gap-2 text-xs font-bold text-neutral-400">
                      <div className="w-1 h-1 rounded-full bg-synapse-primary" />
                      {s}
                   </div>
                 ))}
              </div>
           </section>

           <section className="space-y-4">
              <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Medical Context</h3>
              <div className="space-y-3">
                 <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1">
                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Chronic Conditions</p>
                    <p className="text-[10px] font-bold text-white uppercase tracking-tight">None Reported</p>
                 </div>
                 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Allergies</p>
                    <p className="text-[10px] font-bold text-red-200 uppercase tracking-tight">Penicillin</p>
                 </div>
              </div>
           </section>
        </div>

        {/* Center: Video Feeds */}
        <div className="flex-1 bg-black flex flex-col relative p-4">
           {/* Main Feed (Doctor) */}
           <div className="flex-1 rounded-3xl overflow-hidden bg-neutral-900 border border-white/5 flex items-center justify-center relative group">
              {!isCameraOff ? (
                <div className="text-center space-y-4">
                   <div className="w-20 h-20 rounded-full bg-synapse-primary/10 border border-synapse-primary/20 flex items-center justify-center mx-auto">
                      <User className="w-10 h-10 text-synapse-primary" />
                   </div>
                   <p className="text-mono-xs text-neutral-500 uppercase tracking-[0.3em]">Dr. Sarah Okello Camera Feed</p>
                </div>
              ) : (
                <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center">
                   <VideoOff className="w-12 h-12 text-neutral-800" />
                </div>
              )}

              {/* PiP (Patient) */}
              <div className="absolute bottom-6 right-6 w-48 h-36 bg-neutral-800 rounded-2xl border-2 border-white/10 shadow-2xl overflow-hidden flex items-center justify-center">
                 <div className="text-center">
                    <User className="w-6 h-6 text-neutral-600 mx-auto mb-2" />
                    <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Patient (You)</p>
                 </div>
              </div>

              {/* Status Overlay */}
              <div className="absolute top-6 left-6 flex gap-2">
                 <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">End-to-End Encrypted</span>
                 </div>
              </div>
           </div>

           {/* Controls */}
           <div className="h-24 flex items-center justify-center gap-4 shrink-0">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "w-12 h-12 rounded-full border flex items-center justify-center transition-all",
                  isMuted ? "bg-red-500 border-red-500 text-white" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                )}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setIsCameraOff(!isCameraOff)}
                className={cn(
                  "w-12 h-12 rounded-full border flex items-center justify-center transition-all",
                  isCameraOff ? "bg-red-500 border-red-500 text-white" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                )}
              >
                {isCameraOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
              </button>
              <button className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-all">
                <Monitor className="w-5 h-5" />
              </button>
              <button className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-all">
                <MessageSquare className="w-5 h-5" />
              </button>
              <div className="w-4" />
              <button
                onClick={handleEndCall}
                className="px-6 h-12 rounded-full bg-red-500 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                <PhoneOff className="w-4 h-4" /> End Consultation
              </button>
           </div>
        </div>

        {/* Right: Quick Orders */}
        <div className="hidden xl:flex w-80 border-l border-white/5 flex-col bg-synapse-dark/20 p-6 space-y-8 overflow-y-auto">
           <section className="space-y-4">
              <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Clinical Assistant</h3>
              <div className="p-4 rounded-2xl bg-synapse-primary/5 border border-synapse-primary/20 space-y-3">
                 <div className="flex items-center gap-2">
                    <Activity className="w-3 h-3 text-synapse-primary" />
                    <span className="text-[10px] font-black text-synapse-primary uppercase tracking-widest">AI Differential</span>
                 </div>
                 <div className="space-y-2">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-bold text-white uppercase tracking-tight">1. Malaria (Uncomplicated)</span>
                       <span className="text-[9px] font-bold text-synapse-primary">84%</span>
                    </div>
                    <div className="flex items-center justify-between opacity-60">
                       <span className="text-[10px] font-bold text-white uppercase tracking-tight">2. Viral URTI</span>
                       <span className="text-[9px] font-bold text-neutral-500">12%</span>
                    </div>
                 </div>
              </div>
           </section>

           <section className="space-y-4">
              <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Quick Orders</h3>
              <div className="space-y-2">
                 {[
                   { label: 'Malaria RDT', type: 'Lab' },
                   { label: 'Full Blood Count', type: 'Lab' },
                   { label: 'Paracetamol 500mg', type: 'Pharmacy' },
                 ].map((order, i) => (
                   <button key={i} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between hover:border-synapse-primary/50 transition-colors group">
                      <div className="text-left">
                         <p className="text-[10px] font-bold text-white uppercase tracking-tight">{order.label}</p>
                         <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">{order.type}</p>
                      </div>
                      <Plus className="w-3 h-3 text-neutral-500 group-hover:text-synapse-primary transition-colors" />
                   </button>
                 ))}
              </div>
           </section>

           <section className="mt-auto p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center gap-2">
                 <FileText className="w-3 h-3 text-synapse-primary" />
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">AI SOAP Note</span>
              </div>
              <p className="text-[9px] text-neutral-500 font-bold leading-relaxed uppercase tracking-tight">Drafting live based on conversation... 82% complete.</p>
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-synapse-primary animate-pulse" style={{ width: '82%' }} />
              </div>
           </section>
        </div>
      </main>

      {/* Summary Modal */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-synapse-black/95 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-2xl w-full card p-10 space-y-8"
            >
              <div className="text-center space-y-2">
                 <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                 </div>
                 <h2 className="heading-2">Consultation Ended</h2>
                 <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Call Duration: {formatTimer(timer)}</p>
              </div>

              <div className="space-y-6">
                 <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                       <h3 className="text-mono-xs text-neutral-400">AI-Generated SOAP Note</h3>
                       <button className="text-[10px] font-black text-synapse-primary uppercase tracking-widest">Edit Note</button>
                    </div>
                    <div className="p-6 bg-white/5 rounded-2xl font-mono text-[11px] leading-relaxed text-neutral-300">
                       <p className="mb-2 uppercase text-white font-bold tracking-widest opacity-50">Subjective:</p>
                       <p className="mb-4">28M presents with a 3-day history of high-grade fever, associated with rigors and intense frontal headache. Patient reports localized muscle pain and fatigue. No cough or abdominal pain reported.</p>

                       <p className="mb-2 uppercase text-white font-bold tracking-widest opacity-50">Objective:</p>
                       <p className="mb-4">Patient appears alert but visibly fatigued. No obvious respiratory distress noted via video assessment.</p>

                       <p className="mb-2 uppercase text-white font-bold tracking-widest opacity-50">Assessment:</p>
                       <p className="mb-4">? Uncomplicated Malaria (Primary differential based on regional prevalence and symptom profile). ? Viral Syndrome.</p>

                       <p className="mb-2 uppercase text-white font-bold tracking-widest opacity-50">Plan:</p>
                       <p>1. Laboratory: Malaria RDT, Full Blood Count. 2. Pharmacy: Paracetamol 1g TDS for fever. 3. Follow-up: Review lab results via patient portal.</p>
                    </div>
                 </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 pt-4">
                 <button className="btn-secondary flex-1 py-4 text-[10px]">Print Record</button>
                 <button
                   onClick={() => navigate('/os/doctor/queue')}
                   className="btn-primary flex-1 py-4 text-[10px] group"
                 >
                   Sign & Send Prescription <ChevronRight className="w-4 h-4 ml-2 inline group-hover:translate-x-1 transition-transform" />
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
