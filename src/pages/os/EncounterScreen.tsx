import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Stethoscope, 
  FileText, 
  Beaker, 
  ShieldCheck, 
  BrainCircuit, 
  Save, 
  User, 
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { DEMO_PATIENTS } from '../../constants';
import { getClinicalDiagnosis } from '../../services/geminiService';
import { logAction } from '../../services/auditService';
import { cn } from '../../lib/utils';

export default function EncounterScreen() {
  const { id } = useParams();
  const patient = DEMO_PATIENTS.find(p => p.id === id) || DEMO_PATIENTS[0];
  
  const [activeTab, setActiveTab] = useState<'history' | 'exam' | 'diagnosis' | 'orders'>('history');
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [historyTxt, setHistoryTxt] = useState("Patient reports 3-day history of high-grade fever, chills, and headache. Fever is described as intermittent. No cough or diarrhea.");
  const [examTxt, setExamTxt] = useState("Pulse: 110bpm, Temp: 38.9°C, BP: 110/70. Patient appears lethargic. Mild splenomegaly noted.");

  useEffect(() => {
    logAction('u1', 'Dr. Okello Moses', 'Encounter Record Accessed', 'clinical', { patientId: patient.id, description: `Opened record for ${patient.name}` });
  }, [patient.id]);

  const runAI = async () => {
    setIsRunningAI(true);
    logAction('u1', 'Dr. Okello Moses', 'AI Diagnosis Triggered', 'clinical', { patientId: patient.id, description: `AI Copilot run for ${patient.name}` });
    const result = await getClinicalDiagnosis(`Patient: ${patient.name}, ${patient.age}${patient.gender}. History: ${patient.chronicConditions?.join(', ')}`, `${historyTxt} ${examTxt}`);
    setDiagnosis(result);
    setIsRunningAI(false);
    setActiveTab('diagnosis');
  };

  const signEncounter = () => {
    logAction('u1', 'Dr. Okello Moses', 'Encounter Signed & Locked', 'clinical', { patientId: patient.id, description: `Final clinical sign-off for ${patient.name}` });
    alert("Encounter signed and locked. This record is now immutable.");
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-synapse-black text-white">
      {/* Left Column: Patient Context */}
      <aside className="w-72 border-r border-white/5 bg-synapse-dark/50 flex flex-col p-6 overflow-y-auto shrink-0 custom-scrollbar">
        <Link to="/os/doctor/queue" className="flex items-center gap-2 text-mono-xs text-neutral-500 hover:text-synapse-primary transition-colors mb-8 group">
          <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Return to Queue
        </Link>
        
        <div className="mb-8">
          <span className="text-mono-xs text-neutral-600 mb-2 block">Patient Identity</span>
          <div className="mt-2">
            <h2 className="font-black text-xl text-white leading-tight">{patient.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-mono-xs text-neutral-500">{patient.age}Y</span>
              <span className="text-white/10">·</span>
              <span className="text-mono-xs text-neutral-500">{patient.gender === 'M' ? 'M' : 'F'}</span>
              <span className="text-white/10">·</span>
              <span className="text-mono-xs text-neutral-500">{patient.mrn}</span>
            </div>
          </div>
        </div>

        <section className="space-y-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
             <div className="flex items-center gap-2 text-red-500 text-mono-xs mb-3">
               <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> Critical Allergies
             </div>
             <p className="text-xs font-black text-red-200 leading-snug">
               {patient.allergies?.join(', ')}
             </p>
          </div>

          <div className="space-y-3">
             <span className="text-mono-xs text-neutral-600 mb-1 block">Clinical Vitals</span>
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider mb-1">Temp</p>
                  <p className="text-sm font-black text-red-400">38.9°C</p>
                </div>
                <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider mb-1">Pulse</p>
                  <p className="text-sm font-black text-white">110 <span className="text-[10px] text-neutral-600 font-bold uppercase">bpm</span></p>
                </div>
                <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider mb-1">BP</p>
                  <p className="text-sm font-black text-white">110/70</p>
                </div>
                <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-wider mb-1">SpO2</p>
                  <p className="text-sm font-black text-emerald-400">97%</p>
                </div>
             </div>
          </div>

          <div className="bg-synapse-primary/10 border border-synapse-primary/20 rounded-2xl p-4">
             <div className="flex justify-between items-center mb-3">
               <span className="text-mono-xs text-synapse-primary">Insurance Wallet</span>
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             </div>
             <p className="text-xs font-black text-white leading-snug">{patient.insurance?.provider}</p>
             <p className="text-[10px] text-neutral-500 font-mono mt-1 font-bold tracking-tight">{patient.insurance?.policyNumber}</p>
          </div>
        </section>
      </aside>

      {/* Center Column: Encounter Workspace */}
      <main className="flex-1 bg-synapse-black flex flex-col overflow-hidden border-r border-white/5">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 shrink-0">
          <div className="flex gap-4">
            {[
              { id: 'history', label: 'History & Exam', icon: FileText },
              { id: 'diagnosis', label: 'AI Diagnosis', icon: BrainCircuit },
              { id: 'orders', label: 'Results & Orders', icon: Beaker }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center gap-2",
                  activeTab === tab.id 
                    ? "bg-synapse-primary text-synapse-black shadow-lg shadow-cyan-500/20"
                    : "text-neutral-500 hover:text-white"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-mono-xs text-neutral-600">ACUITY</span>
            <div className="h-2 w-12 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-synapse-black/40">
          <AnimatePresence mode="wait">
             {(activeTab === 'history' || activeTab === 'exam') && (
               <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 max-w-4xl">
                 <div className="space-y-3">
                   <label className="text-mono-xs text-neutral-500 flex items-center gap-2">
                     <FileText className="w-3.5 h-3.5 text-synapse-primary" /> Subjective: Chief Complaint & History
                   </label>
                   <textarea 
                     className="input min-h-[160px] resize-none leading-relaxed text-sm font-medium"
                     value={historyTxt}
                     onChange={(e) => setHistoryTxt(e.target.value)}
                   />
                 </div>
                 <div className="space-y-3">
                   <label className="text-mono-xs text-neutral-500 flex items-center gap-2">
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
                    <h3 className="text-mono-xs text-neutral-500">Differential Diagnosis & Clinical RAG</h3>
                    <button 
                      onClick={runAI}
                      disabled={isRunningAI}
                      className={cn(
                        "btn-primary py-2 px-4 text-[10px]",
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
                                      <p className={cn("font-black text-lg", i === 0 ? "text-synapse-black" : "text-white")}>{item.title}</p>
                                      <p className={cn("text-mono-xs mt-1", i === 0 ? "text-neutral-500" : "text-neutral-600")}>ICD-11: {item.code} · {item.ucgCitation}</p>
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
                       <p className="text-mono-xs text-neutral-600 px-10 text-center max-w-sm">AI Copilot awaiting subjective data to generate grounded differential</p>
                    </div>
                  )}

                  {diagnosis && (
                    <div className="mt-8 bg-synapse-primary text-synapse-black p-6 rounded-3xl flex items-center gap-6 shadow-2xl shadow-cyan-500/20">
                       <div className="bg-white/20 w-14 h-14 rounded-xl flex items-center justify-center shrink-0">
                         <ShieldCheck className="w-8 h-8" />
                       </div>
                       <div className="flex-1">
                         <p className="text-mono-xs text-synapse-black/60 mb-1 font-black">Protocol Treatment Recommendation</p>
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
           <div className="flex items-center gap-6 text-mono-xs text-neutral-600">
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> FHIR Connect</span>
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Insurance Active</span>
           </div>
           <div className="flex gap-4">
              <button className="btn-secondary py-2 px-6 text-[10px]">REFER PATIENT</button>
              <button 
                onClick={signEncounter}
                className="btn-primary py-2 px-6 text-[10px]"
              >
                SIGN & LOCK ENCOUNTER
              </button>
           </div>
        </footer>
      </main>

      {/* Right Column: AI Rail */}
      <aside className="w-80 bg-synapse-dark/30 flex flex-col shrink-0">
         <div className="p-5 border-b border-white/5 bg-synapse-black flex items-center justify-between shrink-0">
            <span className="text-mono-xs text-white">Guidelines</span>
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-synapse-primary" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
            </div>
         </div>
         
         <div className="p-6 flex-1 space-y-8 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
               <span className="text-mono-xs text-neutral-600">Grounded Context</span>
               <div className="p-5 bg-white/5 border border-white/5 rounded-2xl space-y-4 group hover:border-synapse-primary/30 transition-colors">
                  <p className="text-mono-xs text-synapse-primary">UCG 2023 EDITION</p>
                  <p className="text-xs text-neutral-400 font-bold italic leading-relaxed">"In patients with features of severe malaria, parenteral artesunate is the preferred treatment."</p>
                  <button className="text-mono-xs text-synapse-primary hover:text-white transition-colors flex items-center gap-2">
                    Open Protocol <ExternalLink className="w-3 h-3" />
                  </button>
               </div>
            </div>

            <div className="space-y-4">
               <span className="text-mono-xs text-neutral-600">Safety Check</span>
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
                  <span className="text-mono-xs text-neutral-600">Investigations</span>
                  <span className="text-mono-xs text-white bg-white/5 px-2 py-0.5 rounded-md">2</span>
               </div>
               <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-2xl group hover:border-white/10 transition-colors">
                     <span className="text-xs font-black text-neutral-300 uppercase">Malaria RDT</span>
                     <span className="text-mono-xs text-synapse-primary font-black">PENDING</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-2xl opacity-40 group hover:border-white/10 transition-colors">
                     <span className="text-xs font-black text-neutral-500 uppercase">FBC Test</span>
                     <span className="text-mono-xs text-neutral-700">REQUIRED</span>
                  </div>
               </div>
            </div>
         </div>
      </aside>
    </div>
  );
}
