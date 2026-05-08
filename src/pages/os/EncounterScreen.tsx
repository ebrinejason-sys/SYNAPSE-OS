import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft, 
  ExternalLink,
  FileText, 
  ShieldCheck, 
  Stethoscope,
  Clock,
  AlertCircle,
  MoreVertical,
  Pill,
  Microscope,
  History,
  ClipboardList,
  AlertTriangle
} from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useDemoPatientQueue } from '../../hooks/useDemoData';

export default function EncounterScreen() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<'history' | 'diagnosis' | 'orders' | 'notes'>('history');
  const [historyTxt, setHistoryTxt] = useState('Patient presents with high-grade fever (39.2°C) for 3 days, accompanied by chills, severe headache, and joint pain. No cough or diarrhea reported. Last meal was 4 hours ago.');
  const [examTxt, setExamTxt] = useState('Patient appears ill and lethargic. Sclera slightly icteric. Abdomen soft but tender in the left upper quadrant. No neck stiffness.');
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any>(null);

  const { patients } = useDemoPatientQueue('');
  const patientEncounter = patients.find(p => p.id === id);
  const patientName = patientEncounter?.patient ? `${patientEncounter.patient.first_name} ${patientEncounter.patient.last_name}` : 'Samuel Kato';

  const runAI = () => {
    setIsRunningAI(true);
    setTimeout(() => {
      setDiagnosis({
        differential: [
          { title: 'Severe Malaria', probability: 0.94, code: '1F40.0', ucgCitation: 'UCG 2023 Section 5.1' },
          { title: 'Typhoid Fever', probability: 0.12, code: '1A07.0', ucgCitation: 'UCG 2023 Section 5.4' },
          { title: 'Dengue Fever', probability: 0.08, code: '1D20', ucgCitation: 'UCG 2023 Section 5.8' }
        ],
        recommendations: [
          'Initiate IV Artesunate 2.4mg/kg loading dose immediately as per UCG Section 5.1.1.',
          'Full Blood Count (FBC) and Liver Function Tests (LFTs) required.',
          'Monitor blood glucose every 4 hours for hypoglycemia.'
        ]
      });
      setIsRunningAI(false);
    }, 2500);
  };

  const signEncounter = () => {
    alert('Encounter signed and locked. ICD-11 codes submitted to insurance gateway.');
  };

  return (
    <div className="flex h-[calc(100vh-64px-48px)] bg-synapse-black text-white overflow-hidden selection:bg-synapse-primary/30 selection:text-cyan-200">
      {/* Left Column: Patient Context */}
      <aside className="w-80 border-r border-white/5 bg-synapse-dark/30 flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5 bg-synapse-black">
          <Link to="/doctor/queue" className="flex items-center gap-2 text-mono-xs text-neutral-500 hover:text-synapse-primary transition-colors mb-8 group">
            <ChevronLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> BACK TO QUEUE
          </Link>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-synapse-primary/10 rounded-2xl flex items-center justify-center text-synapse-primary font-black text-lg">
              {patientName.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none mb-1">{patientName}</h2>
              <p className="text-mono-xs text-neutral-600 uppercase tracking-widest">{id || 'MUL-2024-0891'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[9px] text-neutral-600 uppercase font-black mb-1">Blood Group</p>
                <p className="text-xs font-black text-white">O POSITIVE</p>
             </div>
             <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-[9px] text-neutral-600 uppercase font-black mb-1">Insurance</p>
                <p className="text-xs font-black text-emerald-500">PRUDENTIAL</p>
             </div>
          </div>
        </div>

        <div className="p-6 flex-1 space-y-8 overflow-y-auto custom-scrollbar">
           <div className="space-y-4">
              <span className="text-mono-xs text-neutral-600 uppercase tracking-widest">Active Vitals</span>
              <div className="space-y-3">
                 {[
                   { label: 'Temp', value: '39.2', unit: '°C', status: 'critical' },
                   { label: 'BP', value: '110/70', unit: 'mmHg', status: 'normal' },
                   { label: 'SpO2', value: '96', unit: '%', status: 'normal' },
                   { label: 'HR', value: '104', unit: 'bpm', status: 'warning' }
                 ].map((v, i) => (
                   <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                      <span className="text-[10px] font-black text-neutral-500 uppercase">{v.label}</span>
                      <span className={cn(
                        "text-xs font-black",
                        v.status === 'critical' ? 'text-red-500' : v.status === 'warning' ? 'text-amber-500' : 'text-white'
                      )}>{v.value}<span className="text-[9px] ml-0.5 opacity-50">{v.unit}</span></span>
                   </div>
                 ))}
              </div>
           </div>

           <div className="space-y-4">
              <span className="text-mono-xs text-neutral-600 uppercase tracking-widest">Known Allergies</span>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                 <p className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2">
                   <AlertTriangle className="w-3 h-3" /> PENICILLIN
                 </p>
              </div>
           </div>
        </div>
      </aside>

      {/* Center Column: Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 bg-synapse-black">
        <header className="h-16 border-b border-white/5 px-8 flex items-center gap-10 shrink-0">
           {['history', 'diagnosis', 'orders', 'notes'].map((tab) => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab as any)}
               className={cn(
                 "text-[10px] font-black uppercase tracking-[0.2em] relative h-full transition-colors",
                 activeTab === tab ? "text-synapse-primary after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-synapse-primary" : "text-neutral-500 hover:text-white"
               )}
             >
               {tab}
             </button>
           ))}
        </header>

        <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
             {activeTab === 'history' && (
               <motion.div
                 key="history"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 className="space-y-8 max-w-4xl"
               >
                 <div className="space-y-3">
                   <label className="text-mono-xs text-neutral-500 flex items-center gap-2 uppercase tracking-widest">
                     <FileText className="w-3.5 h-3.5 text-synapse-primary" /> Subjective: Chief Complaint & History
                   </label>
                   <textarea 
                     className="input min-h-[160px] resize-none leading-relaxed text-sm font-medium"
                     value={historyTxt}
                     onChange={(e) => setHistoryTxt(e.target.value)}
                   />
                 </div>
                 <div className="space-y-3">
                   <label className="text-mono-xs text-neutral-500 flex items-center gap-2 uppercase tracking-widest">
                     <Stethoscope className="w-3.5 h-3.5 text-synapse-primary" /> Objective: Physical Examination
                   </label>
                   <textarea 
                     className="input min-h-[160px] resize-none leading-relaxed text-sm font-medium"
                     value={examTxt}
                     onChange={(e) => setExamTxt(e.target.value)}
                   />
                 </div>
               </motion.div>
             )}

             {activeTab === 'diagnosis' && (
                <motion.div key="diagnosis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-mono-xs text-neutral-500 uppercase tracking-widest">Differential Diagnosis & Clinical RAG</h3>
                    <button 
                      onClick={runAI}
                      disabled={isRunningAI}
                      className={cn(
                        "btn-primary py-2 px-4 text-[10px] uppercase tracking-widest",
                        isRunningAI && "opacity-50"
                      )}
                    >
                      <BrainCircuit className={cn("w-3.5 h-3.5 mr-2 inline-block", isRunningAI && "animate-pulse")} />
                      {isRunningAI ? "Processing UCG Rules..." : "RUN AI DIAGNOSIS"}
                    </button>
                  </div>

                  {diagnosis ? (
                    <div className="grid grid-cols-1 gap-4">
                       {diagnosis.differential.map((item: any, i: number) => (
                         <div key={i} className={cn(
                            "p-6 rounded-2xl border transition-all",
                            i === 0 ? "bg-white text-synapse-black border-synapse-primary shadow-2xl shadow-cyan-500/10" : "bg-white/5 border-white/5 opacity-50"
                         )}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                   <div className={cn(
                                      "w-14 h-14 rounded-xl flex flex-col items-center justify-center font-black",
                                      i === 0 ? "bg-synapse-primary/10 text-synapse-primary" : "bg-white/5 text-neutral-500"
                                   )}>
                                      <span className="text-xs uppercase">Prob</span>
                                      <span className="text-lg">{Math.round(item.probability * 100)}%</span>
                                   </div>
                                   <div>
                                      <p className={cn("font-black text-lg uppercase tracking-tight", i === 0 ? "text-synapse-black" : "text-white")}>{item.title}</p>
                                      <p className={cn("text-mono-xs mt-1 uppercase tracking-widest", i === 0 ? "text-neutral-500" : "text-neutral-600")}>ICD-11: {item.code} · {item.ucgCitation}</p>
                                   </div>
                                </div>
                                {i === 0 && (
                                   <span className="badge-primary">MATCHED</span>
                                )}
                            </div>
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-neutral-700 gap-4 border-2 border-dashed border-white/5 rounded-[2rem]">
                       <BrainCircuit className="w-12 h-12 opacity-10" />
                       <p className="text-mono-xs text-neutral-600 px-10 text-center max-w-sm uppercase tracking-widest leading-relaxed">AI Copilot awaiting subjective data to generate grounded differential</p>
                    </div>
                  )}

                  {diagnosis && (
                    <div className="mt-8 bg-synapse-primary text-synapse-black p-6 rounded-3xl flex items-center gap-6 shadow-2xl shadow-cyan-500/20">
                       <div className="bg-white/20 w-14 h-14 rounded-xl flex items-center justify-center shrink-0">
                         <ShieldCheck className="w-8 h-8" />
                       </div>
                       <div className="flex-1">
                         <p className="text-mono-xs text-synapse-black/60 mb-1 font-black uppercase tracking-widest">Protocol Treatment Recommendation</p>
                         <p className="text-sm font-black leading-relaxed uppercase tracking-tight">
                            {diagnosis.recommendations[0] || "Initiate IV Artesunate 2.4mg/kg loading dose immediately as per UCG Section 5.1.1."}
                         </p>
                       </div>
                    </div>
                  )}
                </motion.div>
             )}
          </AnimatePresence>
        </div>

        <footer className="h-16 border-t border-white/5 px-8 flex items-center justify-between shrink-0 bg-synapse-black/80 backdrop-blur-md">
           <div className="flex items-center gap-6 text-mono-xs text-neutral-600 uppercase tracking-widest">
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> FHIR Connect</span>
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Insurance Active</span>
           </div>
           <div className="flex gap-4">
              <button className="btn-secondary py-2 px-6 text-[10px] uppercase tracking-widest font-black">REFER PATIENT</button>
              <button 
                onClick={signEncounter}
                className="btn-primary py-2 px-6 text-[10px] uppercase tracking-widest font-black"
              >
                SIGN & LOCK ENCOUNTER
              </button>
           </div>
        </footer>
      </main>

      {/* Right Column: AI Rail */}
      <aside className="w-80 bg-synapse-dark/30 flex flex-col shrink-0">
         <div className="p-5 border-b border-white/5 bg-synapse-black flex items-center justify-between shrink-0">
            <span className="text-mono-xs text-white uppercase tracking-widest">Guidelines</span>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-synapse-primary" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            </div>
         </div>
         
         <div className="p-6 flex-1 space-y-8 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
               <span className="text-mono-xs text-neutral-600 uppercase tracking-widest">Grounded Context</span>
               <div className="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-4 group hover:border-synapse-primary/30 transition-colors">
                  <p className="text-mono-xs text-synapse-primary uppercase tracking-widest font-black">UCG 2023 EDITION</p>
                  <p className="text-xs text-neutral-400 font-bold italic leading-relaxed">"In patients with features of severe malaria, parenteral artesunate is the preferred treatment."</p>
                  <button className="text-mono-xs text-synapse-primary hover:text-white transition-colors flex items-center gap-2 uppercase tracking-widest font-black">
                    Open Protocol <ExternalLink className="w-3 h-3" />
                  </button>
               </div>
            </div>

            <div className="space-y-4">
               <span className="text-mono-xs text-neutral-600 uppercase tracking-widest">Safety Check</span>
               <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex gap-4 items-center group hover:border-emerald-500/30 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white uppercase tracking-wider">Zero Interactions</p>
                    <p className="text-mono-xs text-neutral-600 truncate uppercase">Safe with current meds</p>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <span className="text-mono-xs text-neutral-600 uppercase tracking-widest">Investigations</span>
                  <span className="text-mono-xs text-white bg-white/5 px-2 py-0.5 rounded-md">2</span>
               </div>
               <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-2xl group hover:border-white/10 transition-colors">
                     <span className="text-xs font-black text-neutral-300 uppercase tracking-tight">Malaria RDT</span>
                     <span className="text-mono-xs text-synapse-primary font-black">PENDING</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-2xl opacity-40 group hover:border-white/10 transition-colors">
                     <span className="text-xs font-black text-neutral-500 uppercase tracking-tight">FBC Test</span>
                     <span className="text-mono-xs text-neutral-700">REQUIRED</span>
                  </div>
               </div>
            </div>
         </div>
      </aside>
    </div>
  );
}
