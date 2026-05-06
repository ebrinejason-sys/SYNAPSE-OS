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
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Left Column: Patient Context */}
      <aside className="w-64 border-r border-slate-200 bg-slate-50/50 flex flex-col p-4 overflow-y-auto shrink-0 custom-scrollbar">
        <Link to="/os/doctor/queue" className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors mb-6 uppercase tracking-widest">
          <ChevronLeft className="w-3.5 h-3.5" /> Return to Queue
        </Link>
        
        <div className="mb-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Patient Identity</span>
          <div className="mt-2">
            <h2 className="font-bold text-lg text-slate-900 leading-tight">{patient.name}</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">{patient.age}Y · {patient.gender === 'M' ? 'Male' : 'Female'} · {patient.mrn}</p>
          </div>
        </div>

        <section className="space-y-5">
          <div className="bg-red-50/50 border border-red-100 rounded-xl p-4">
             <div className="flex items-center gap-2 text-red-700 font-bold text-[10px] uppercase tracking-wider mb-2">
               <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" /> Critical Allergies
             </div>
             <p className="text-sm font-bold text-red-900 leading-snug">
               {patient.allergies?.join(', ')}
             </p>
          </div>

          <div className="space-y-2">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Vitals</span>
             <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Temp</p>
                  <p className="text-sm font-bold text-red-600">38.9°C</p>
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Pulse</p>
                  <p className="text-sm font-bold text-slate-900">110 <span className="text-[10px] text-slate-400 font-medium">bpm</span></p>
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">BP</p>
                  <p className="text-sm font-bold text-slate-900">110/70</p>
                </div>
                <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">SpO2</p>
                  <p className="text-sm font-bold text-emerald-600">97%</p>
                </div>
             </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mt-auto">
             <div className="flex justify-between items-center mb-1">
               <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Insurance Wallet</span>
               <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">Active</span>
             </div>
             <p className="text-sm font-bold text-slate-900 leading-snug">{patient.insurance?.provider}</p>
             <p className="text-[9px] text-emerald-700 font-mono mt-1 font-bold">{patient.insurance?.policyNumber}</p>
          </div>
        </section>
      </aside>

      {/* Center Column: Encounter Workspace */}
      <main className="flex-1 bg-white flex flex-col overflow-hidden">
        <header className="h-16 border-b border-slate-100 flex items-center justify-between px-6 shrink-0">
          <div className="flex gap-2">
            {[
              { id: 'history', label: 'History & Exam', icon: FileText },
              { id: 'diagnosis', label: 'AI Diagnosis', icon: BrainCircuit },
              { id: 'orders', label: 'Results & Orders', icon: Beaker }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
                  activeTab === tab.id 
                    ? "bg-slate-900 text-white shadow-md shadow-slate-200" 
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Triage Acuity</span>
            <div className="h-3 w-10 bg-amber-400 rounded-full shadow-inner" />
          </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
             {(activeTab === 'history' || activeTab === 'exam') && (
               <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                 <div className="space-y-3">
                   <label className="text-sm font-bold text-slate-700 tracking-tight flex items-center gap-2">
                     <FileText className="w-4 h-4 text-slate-400" /> Subjective: Chief Complaint & History
                   </label>
                   <textarea 
                     className="w-full p-5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 resize-none font-medium leading-relaxed text-sm min-h-[160px]"
                     value={historyTxt}
                     onChange={(e) => setHistoryTxt(e.target.value)}
                   />
                 </div>
                 <div className="space-y-3">
                   <label className="text-sm font-bold text-slate-700 tracking-tight flex items-center gap-2">
                     <Stethoscope className="w-4 h-4 text-slate-400" /> Objective: Physical Examination
                   </label>
                   <textarea 
                     className="w-full p-5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 resize-none font-medium leading-relaxed text-sm min-h-[160px]"
                     value={examTxt}
                     onChange={(e) => setExamTxt(e.target.value)}
                   />
                 </div>
               </motion.div>
             )}

             {activeTab === 'diagnosis' && (
                <motion.div key="diagnosis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Differential Diagnosis & Clinical RAG</h3>
                    <button 
                      onClick={runAI}
                      disabled={isRunningAI}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border",
                        isRunningAI 
                          ? "bg-slate-50 text-slate-400 border-slate-100" 
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-sm"
                      )}
                    >
                      <BrainCircuit className={cn("w-3.5 h-3.5", isRunningAI && "animate-pulse")} />
                      {isRunningAI ? "Processing UCG Rules..." : "RUN AI DIAGNOSIS"}
                    </button>
                  </div>

                  {diagnosis ? (
                    <div className="grid grid-cols-1 gap-4">
                       {diagnosis.differential.map((item: any, i: number) => (
                         <div key={i} className={cn(
                            "p-5 rounded-xl border-2 flex items-center justify-between shadow-sm transition-all",
                            i === 0 ? "border-emerald-500 bg-white" : "border-slate-100 bg-slate-50/30 opacity-70"
                         )}>
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                   "w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold",
                                   i === 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                )}>
                                   <span className="text-xs">{Math.round(item.probability * 100)}%</span>
                                </div>
                                <div>
                                   <p className="font-bold text-slate-900">{item.title}</p>
                                   <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">ICD-11: {item.code} • {item.ucgCitation}</p>
                                </div>
                            </div>
                            {i === 0 && (
                               <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">MATCHED</span>
                            )}
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-4 border-2 border-dashed border-slate-100 rounded-3xl">
                       <BrainCircuit className="w-12 h-12 opacity-30" />
                       <p className="text-xs font-bold uppercase tracking-[0.2em] px-10 text-center">AI Copilot awaiting subjective data to generate grounded differential</p>
                    </div>
                  )}

                  {diagnosis && (
                    <div className="mt-8 bg-slate-900 p-5 rounded-2xl text-white flex items-center gap-4 shadow-xl shadow-slate-200">
                       <div className="bg-emerald-500 w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
                         <ShieldCheck className="w-7 h-7" />
                       </div>
                       <div className="flex-1">
                         <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Protocol Treatment Recommendation</p>
                         <p className="text-sm font-medium leading-relaxed">
                            {diagnosis.recommendations[0] || "Initiate IV Artesunate 2.4mg/kg loading dose immediately as per UCG Section 5.1.1."}
                         </p>
                       </div>
                    </div>
                  )}
                </motion.div>
             )}
          </AnimatePresence>
        </div>

        <footer className="h-16 border-t border-slate-100 px-6 flex items-center justify-between shrink-0 bg-white">
           <div className="flex items-center gap-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> FHIR Connect</span>
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Insurance Confirmed</span>
           </div>
           <div className="flex gap-3">
              <button className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">REFER PATIENT</button>
              <button 
                onClick={signEncounter}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                SIGN & LOCK ENCOUNTER
              </button>
           </div>
        </footer>
      </main>

      {/* Right Column: AI Rail */}
      <aside className="w-80 border-l border-slate-200 bg-slate-50/50 flex flex-col shrink-0">
         <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold text-slate-900 uppercase tracking-widest leading-none">Clinical Guidelines</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            </div>
         </div>
         
         <div className="p-4 flex-1 space-y-5 overflow-y-auto custom-scrollbar">
            <div className="space-y-2.5">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grounded Context</span>
               <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
                  <p className="text-[11px] font-bold text-slate-900">Uganda Clinical Guidelines 2023</p>
                  <p className="text-[11px] text-slate-500 font-medium italic leading-relaxed">"In patients with features of severe malaria, parenteral artesunate is the preferred treatment. If artesunate is not available, artemether or quinine can be used..."</p>
                  <button className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:underline flex items-center gap-1">
                    Full Section 5.1 <ExternalLink className="w-3 h-3" />
                  </button>
               </div>
            </div>

            <div className="space-y-2.5">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Safety Check</span>
               <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm flex gap-3 items-center">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-900">Zero Interactions</p>
                    <p className="text-[10px] text-slate-500 truncate font-medium">Safe with current multivitamin regimen</p>
                  </div>
               </div>
            </div>

            <div className="space-y-2.5">
               <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Investigations</span>
                  <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-400">2</span>
               </div>
               <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                     <span className="text-[11px] font-bold text-slate-700">Malaria RDT</span>
                     <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded">Pending</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm opacity-50">
                     <span className="text-[11px] font-bold text-slate-700">Full Blood Count</span>
                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Required</span>
                  </div>
               </div>
            </div>
         </div>
      </aside>
    </div>
  );
}
