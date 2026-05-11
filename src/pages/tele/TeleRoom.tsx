import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, Link } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share,
  Clipboard,
  XCircle,
  Activity,
  MessageSquare,
  User,
  Clock,
  Shield,
  Layout,
  CheckCircle,
  FileText,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Logo } from '../../components/Logo';
import { cn } from '../../lib/utils';

export default function TeleRoom() {
  const { id } = useParams();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [showTranscript, setShowTranscription] = useState(true);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const transcript = [
    { time: '0:12', role: 'Doctor', text: 'Good morning John, I see you have been feeling unwell for a few days.' },
    { time: '0:18', role: 'Patient', text: 'Yes, Doctor. The fever started on Monday and I have a bad headache.' },
    { time: '0:25', role: 'Doctor', text: 'I understand. Have you noticed any chills or rigors?' },
    { time: '0:31', role: 'Patient', text: 'Yes, especially at night.' }
  ];

  if (callEnded) {
    return (
      <div className="min-h-screen bg-synapse-black text-white flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-xl w-full">
          <div className="card p-10 space-y-8 text-center border-white/10 shadow-2xl">
             <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
             </div>
             <h1 className="text-3xl font-black uppercase tracking-tighter">Consultation Ended</h1>
             <p className="text-mono-xs text-neutral-500">Total Duration: {formatTime(timer)}</p>

             <div className="bg-synapse-dark border border-white/5 p-8 rounded-2xl text-left space-y-6">
                <div className="flex items-center gap-3 text-synapse-primary">
                   <FileText className="w-5 h-5" />
                   <span className="text-xs font-black uppercase tracking-widest">AI-Generated SOAP Note</span>
                </div>
                <div className="font-mono text-[10px] leading-relaxed text-neutral-400 space-y-4">
                   <p><span className="text-white">S:</span> 28M presenting with acute fever and headache (duration: 3 days). Positive for chills and night rigors. Nil allergies...</p>
                   <p><span className="text-white">O:</span> Video clinical assessment: Patient appears alert and orientated. No visible respiratory distress. SpO2 96% on room air...</p>
                   <p><span className="text-white">A:</span> ? Malaria (Uncomplicated) - Triage Level: Urgent. Differential: Typhoid Fever.</p>
                   <p><span className="text-white">P:</span> Malaria RDT ordered. Paracetamol 1g TDS for fever. Advised on danger signs. Review in 48h or if symptoms worsen.</p>
                </div>
                <div className="pt-4 border-t border-white/5">
                   <p className="text-[9px] font-bold text-neutral-600 uppercase italic">Notes reviewed and signed by Dr. Okello Moses via Synapse OS</p>
                </div>
             </div>

             <div className="space-y-4">
                <button className="btn-primary w-full py-4 text-[10px]">DOWNLOAD VISIT SUMMARY</button>
                <Link to="/" className="btn-secondary w-full py-4 text-[10px] block border-white/5">RETURN TO DASHBOARD</Link>
             </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-synapse-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-synapse-black px-6 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-4 sm:gap-6">
          <Logo size="sm" showText={false} />
          <div className="h-6 w-px bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
             <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[120px] sm:max-w-none">Encrypted Room: {id?.substring(0, 8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-8">
           <div className="flex items-center gap-2 text-mono-xs text-neutral-500 font-mono">
              <Clock className="w-3.5 h-3.5 text-synapse-primary" /> {formatTime(timer)}
           </div>
           <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
              <User className="w-3.5 h-3.5 text-synapse-primary hidden sm:block" />
              <span className="text-[10px] font-black uppercase tracking-tight">Dr. Okello Moses</span>
           </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Patient Context (Left) */}
        <aside className="hidden xl:flex w-80 border-r border-white/5 flex-col p-6 space-y-8 bg-synapse-dark/30 overflow-y-auto">
           <section className="space-y-6">
              <div className="text-mono-xs text-synapse-primary tracking-[0.3em]">Patient Intake</div>
              <div className="space-y-4">
                 <div>
                    <div className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mb-1">Name / Demographics</div>
                    <div className="text-sm font-black uppercase">John Ssemwanga (28M)</div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mb-1">Triage Level</div>
                    <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-black uppercase tracking-widest">
                       <Activity className="w-3 h-3" /> Urgent (Score 6.8)
                    </div>
                 </div>
              </div>
           </section>

           <section className="space-y-4">
              <div className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mb-1">Reported Symptoms</div>
              <ul className="space-y-2">
                 {['Fever (3 days)', 'Severe Headache', 'Rigors', 'Nausea'].map(s => (
                   <li key={s} className="text-[11px] font-bold text-neutral-300 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-synapse-primary" /> {s}
                   </li>
                 ))}
              </ul>
           </section>

           <section className="pt-6 border-t border-white/5 space-y-4">
              <div className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mb-1">Transcription</div>
              <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                 {transcript.map((line, i) => (
                   <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-[8px] font-black text-neutral-500 uppercase">
                         <span>{line.role}</span>
                         <span className="font-mono">{line.time}</span>
                      </div>
                      <p className="text-[10px] font-medium text-neutral-400 leading-relaxed italic">"{line.text}"</p>
                   </div>
                 ))}
                 <div className="flex items-center gap-2 text-synapse-primary animate-pulse">
                    <MessageSquare className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase">Listening...</span>
                 </div>
              </div>
           </section>
        </aside>

        {/* Video Area (Center) */}
        <main className="flex-1 relative bg-black flex items-center justify-center p-4">
           {/* Doctor Feed (Placeholder) */}
           <div className="w-full h-full max-w-5xl aspect-video bg-neutral-900 rounded-3xl border border-white/10 flex items-center justify-center relative overflow-hidden shadow-2xl">
              <div className="text-center space-y-4">
                 <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/10">
                    <User className="w-10 h-10 text-neutral-700" />
                 </div>
                 <p className="text-mono-xs text-neutral-600 uppercase tracking-widest">Connecting Doctor Feed...</p>
              </div>

              {/* Patient PiP (Placeholder) */}
              <div className="absolute bottom-6 right-6 w-32 sm:w-48 aspect-video bg-neutral-800 rounded-xl border border-white/20 shadow-2xl flex items-center justify-center overflow-hidden">
                 <div className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Self View</div>
              </div>

              <div className="absolute top-6 left-6 flex gap-2">
                 <div className="bg-synapse-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[9px] font-black uppercase flex items-center gap-2">
                    <Shield className="w-3 h-3 text-emerald-500" /> End-to-End Secure
                 </div>
              </div>
           </div>
        </main>

        {/* Quick Orders (Right) */}
        <aside className="hidden lg:flex w-80 border-l border-white/5 flex-col p-6 space-y-8 bg-synapse-dark/30">
           <div className="text-mono-xs text-synapse-primary tracking-[0.3em]">Quick Actions</div>
           <div className="space-y-6">
              <button className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-white/10 transition-all group">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Working Diagnosis</span>
                    <MessageSquare className="w-3 h-3 text-neutral-600" />
                 </div>
                 <div className="text-xs font-black uppercase text-neutral-400 group-hover:text-white transition-colors">Pending Assessment</div>
              </button>

              <div className="space-y-3">
                 <div className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">AI Clinical Suggestion</div>
                 <div className="p-4 bg-synapse-primary/5 border border-synapse-primary/20 rounded-xl space-y-3">
                    <p className="text-[10px] font-bold text-neutral-300 leading-relaxed italic">Patient reports chills and night fever in Kampala. Recommend Malaria RDT (UCG 2023).</p>
                    <button className="btn-primary w-full py-2.5 text-[9px]">APPLY ORDERS</button>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                    + Add Lab
                 </button>
                 <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                    + Add Med
                 </button>
              </div>

              <div className="pt-6 border-t border-white/5">
                 <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Billing Estimator</span>
                       <span className="text-[10px] font-black text-white">UGX 30,000</span>
                    </div>
                    <div className="flex items-center justify-between opacity-50">
                       <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Insurance</span>
                       <span className="text-[9px] font-black text-white">NOT APPLIED</span>
                    </div>
                 </div>
              </div>
           </div>
        </aside>
      </div>

      {/* Controls Bar */}
      <footer className="h-24 bg-synapse-black border-t border-white/5 px-4 sm:px-8 flex items-center justify-between shrink-0">
         <div className="hidden sm:flex items-center gap-4 w-60">
            <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all group">
               <Clipboard className="w-5 h-5 text-neutral-400 group-hover:text-synapse-primary" />
            </button>
         </div>

         <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all border",
                isMuted ? "bg-red-500/20 border-red-500/40 text-red-500" : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
              )}
            >
               {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={cn(
                "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all border",
                isVideoOff ? "bg-red-500/20 border-red-500/40 text-red-500" : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
              )}
            >
               {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
            <button className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white">
               <Share className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={() => setCallEnded(true)}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-red-600 flex items-center justify-center hover:bg-red-700 transition-all text-white shadow-lg shadow-red-500/20 ml-2 sm:ml-4"
            >
               <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
         </div>

         <div className="hidden sm:flex items-center justify-end gap-4 w-60">
            <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
               <Layout className="w-5 h-5 text-neutral-400" />
            </button>
         </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}
