import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  ArrowLeft,
  Send,
  Check,
  MapPin,
  Info,
  Phone,
  Calendar,
  Video,
  User,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Smartphone,
  Lock
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { CHATBOT_STEPS, calculateTriage } from '../../lib/chatbot-engine';
import { Logo } from '../../components/Logo';

interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
  special?: React.ReactNode;
}

const MultiSelectInput = ({ options, onContinue }: { options: string[], onContinue: (val: string[]) => void }) => {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (opt === 'None') setSelected(['None']);
              else {
                const newSel = selected.includes(opt)
                  ? selected.filter(s => s !== opt)
                  : [...selected.filter(s => s !== 'None'), opt];
                setSelected(newSel);
              }
            }}
            className={cn(
              "p-3 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-left flex items-center justify-between",
              selected.includes(opt) ? "bg-synapse-primary border-synapse-primary text-synapse-black" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
            )}
          >
            {opt}
            {selected.includes(opt) && <Check className="w-3 h-3" />}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={selected.length === 0}
        onClick={() => onContinue(selected)}
        className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        Continue <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default function TeleChatbot() {
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: "Hello! I'm your AI health guide. I'll ask you a few questions to understand your symptoms. This takes about 2 minutes." }
  ]);
  const [triageResult, setTriageResult] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentStepIndex]);

  const handleStart = () => {
    setCurrentStepIndex(0);
    const firstStep = CHATBOT_STEPS[0];
    setMessages([...messages, { role: 'ai', content: firstStep.question }]);
  };

  const handleAnswer = (val: any) => {
    const currentStep = CHATBOT_STEPS[currentStepIndex];
    const newAnswers = { ...answers, [currentStep.key]: val };
    setAnswers(newAnswers);

    const displayVal = Array.isArray(val) ? val.join(', ') : val;
    const userMessage: ChatMessage = { role: 'user', content: String(displayVal) };

    let nextIndex = currentStepIndex + 1;
    while (nextIndex < CHATBOT_STEPS.length) {
      const nextStep = CHATBOT_STEPS[nextIndex];
      if (!nextStep.condition || nextStep.condition(newAnswers)) {
        break;
      }
      nextIndex++;
    }

    if (nextIndex < CHATBOT_STEPS.length) {
      const nextStep = CHATBOT_STEPS[nextIndex];
      let special: React.ReactNode = null;

      if (currentStep.key === 'district') {
        special = (
          <div className="mt-2 flex items-center gap-2 bg-synapse-primary/10 border border-synapse-primary/20 px-3 py-1.5 rounded-lg text-[9px] font-black text-synapse-primary uppercase tracking-tight">
            <MapPin className="w-3 h-3" />
            This helps us find the nearest SynapseOS facility and provide relevant public health alerts.
          </div>
        );
      }

      if (currentStep.key === 'insurance' && String(val).includes('Yes')) {
        special = (
          <div className="mt-2 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-[9px] font-black text-emerald-500 uppercase tracking-tight">
            <Info className="w-3 h-3" />
            You can sync your insurance details on admission. Download the Synapse App to store your insurance card.
          </div>
        );
      }

      setCurrentStepIndex(nextIndex);
      const aiMessage: ChatMessage = { role: 'ai', content: nextStep.question, special };
      setMessages([...messages, userMessage, aiMessage]);
    } else {
      const result = calculateTriage(newAnswers);
      setTriageResult(result);
      setCurrentStepIndex(CHATBOT_STEPS.length);
      setMessages([...messages, userMessage]);
    }
  };

  const renderInput = () => {
    if (currentStepIndex < 0 || currentStepIndex >= CHATBOT_STEPS.length) return null;
    const step = CHATBOT_STEPS[currentStepIndex];

    if (step.type === 'select') {
      return (
        <div className="grid grid-cols-2 gap-2 mt-4">
          {step.options?.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => handleAnswer(opt)}
              className="p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-synapse-primary hover:text-synapse-black transition-all text-left px-4"
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if (step.type === 'multiselect') {
      return <MultiSelectInput options={step.options || []} onContinue={handleAnswer} />;
    }

    if (step.type === 'scale') {
      return (
        <div className="mt-4 space-y-6">
          <div className="flex justify-between px-2 gap-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => handleAnswer(n)}
                className="flex-1 aspect-square rounded-lg border border-white/10 flex items-center justify-center text-[10px] font-black hover:bg-synapse-primary hover:text-synapse-black transition-all"
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[8px] font-black text-neutral-500 uppercase tracking-widest px-1">
             <span>Mild</span>
             <span>Unbearable</span>
          </div>
        </div>
      );
    }

    if (step.type === 'text' || step.type === 'number') {
      return <TextInput type={step.type} placeholder={step.placeholder} onContinue={handleAnswer} />;
    }

    return null;
  };

  const renderTriage = () => {
    if (!triageResult) return null;
    const { level, explanation } = triageResult;

    if (level === 'emergency') {
      return (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card p-8 border-red-500/30 bg-red-500/5 space-y-8">
           <div className="flex items-center gap-4 text-red-500">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center animate-pulse">
                 <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">Emergency</h2>
           </div>
           <p className="text-xl font-bold text-white leading-relaxed">{explanation}</p>

           <div className="bg-synapse-dark p-6 rounded-2xl border border-white/5 space-y-4">
              <div className="text-mono-xs text-neutral-500 tracking-[0.2em]">Nearest SynapseOS Facility</div>
              <div>
                 <div className="text-lg font-black uppercase">Mulago National Referral Hospital</div>
                 <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1 uppercase font-bold">
                    <MapPin className="w-3 h-3 text-synapse-primary" /> 2.3 km away • Open 24/7
                 </div>
              </div>
              <a href="tel:999" className="btn-primary w-full py-4 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white shadow-red-500/20">
                 <Phone className="w-4 h-4" /> Call Emergency (999)
              </a>
           </div>
        </motion.div>
      );
    }

    const isUrgent = level === 'urgent';
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card p-8 space-y-8">
        <div className={cn("flex items-center gap-4", isUrgent ? "text-amber-500" : "text-emerald-500")}>
           <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", isUrgent ? "bg-amber-500/10" : "bg-emerald-500/10")}>
              {isUrgent ? <Activity className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
           </div>
           <h2 className="text-3xl font-black uppercase tracking-tighter">{level}</h2>
        </div>
        <p className="text-lg font-bold text-neutral-300 leading-relaxed">{explanation}</p>

        <div className="space-y-4">
           <div className="text-mono-xs text-neutral-500 tracking-[0.2em]">Available Appointments</div>
           <div className="space-y-2">
              {[
                { name: 'Dr. Okello Moses', spec: 'General Medicine', time: '10:30 AM', slots: '1 slot' },
                { name: 'Dr. Nalwoga Sarah', spec: 'Family Medicine', time: '2:15 PM', slots: '2 slots' }
              ].map((doc, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => navigate(`/tele/booking?doctor=${i}&name=${doc.name}&time=${doc.time}`)}
                  className="w-full card p-4 flex items-center justify-between hover:border-synapse-primary transition-all group border-white/5"
                >
                   <div className="text-left">
                      <div className="text-sm font-black uppercase group-hover:text-synapse-primary transition-colors">{doc.name}</div>
                      <div className="text-[10px] text-neutral-500 font-bold uppercase">{doc.spec} • {doc.slots}</div>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="text-xs font-black font-mono text-synapse-primary">{doc.time}</div>
                      <ChevronRight className="w-4 h-4 text-neutral-600" />
                   </div>
                </button>
              ))}
           </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-synapse-black text-white selection:bg-synapse-primary/30 flex flex-col">
      <nav className="h-16 border-b border-white/5 bg-synapse-black/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4 sm:gap-8">
           <Link to="/" className="text-neutral-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
           </Link>
           <Logo size="sm" />
        </div>
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
           <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Clinical Network Live</span>
        </div>
      </nav>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 flex flex-col bg-synapse-black border-r border-white/5 relative overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 scroll-smooth">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-[90%] sm:max-w-[85%]",
                    msg.role === 'ai' ? "items-start" : "items-end self-end"
                  )}
                >
                   {msg.role === 'ai' && (
                     <div className="flex items-center gap-2 mb-2 text-[10px] font-black text-synapse-primary uppercase tracking-widest">
                        <Activity className="w-3 h-3" /> AI Assistant
                     </div>
                   )}
                   <div className={cn(
                     "px-5 py-4 rounded-2xl text-sm font-bold leading-relaxed",
                     msg.role === 'ai'
                      ? "bg-emerald-500/10 text-neutral-200 border border-emerald-500/20 rounded-tl-none"
                      : "bg-synapse-primary text-synapse-black rounded-tr-none shadow-lg shadow-cyan-500/10"
                   )}>
                     {msg.content}
                   </div>
                   {msg.special}
                </motion.div>
              ))}

              {currentStepIndex >= 0 && currentStepIndex < CHATBOT_STEPS.length && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-4"
                >
                   <div className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-4">Your Response Required</div>
                   {renderInput()}
                </motion.div>
              )}

              {triageResult && (
                <div className="pt-8">
                   <div className="text-mono-xs text-synapse-primary mb-6 tracking-[0.3em]">Triage Result</div>
                   {renderTriage()}
                </div>
              )}
            </AnimatePresence>
          </div>

          {currentStepIndex === -1 && (
            <div className="p-6 sm:p-8 border-t border-white/5 bg-synapse-dark/50">
               <button
                 type="button"
                 onClick={handleStart}
                 className="btn-primary w-full py-5 flex items-center justify-center gap-3 text-sm shadow-2xl"
               >
                 START CONSULTATION <ChevronRight className="w-4 h-4" />
               </button>
            </div>
          )}

          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-synapse-black text-[9px] font-mono font-bold text-neutral-700 uppercase tracking-widest">
             <span>PROGRESS: STEP {Math.max(0, currentStepIndex + 1)} OF 13</span>
             <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(Math.max(0, currentStepIndex + 1) / 13) * 100}%` }}
                  className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                />
             </div>
          </div>
        </div>

        <div className="hidden lg:block w-[380px] p-10 bg-synapse-dark/50 space-y-12 overflow-y-auto">
          <section className="space-y-6">
            <h3 className="text-mono-xs text-synapse-primary uppercase tracking-[0.3em]">How It Works</h3>
            <div className="space-y-6">
               {[
                 { step: 1, label: 'Answer questions', desc: 'AI triage (2 mins)' },
                 { step: 2, label: 'Get Triaged', desc: 'Clinical risk assessment' },
                 { step: 3, label: 'See a Doctor', desc: 'Secure video call' },
                 { step: 4, label: 'Get Prescription', desc: 'Digital delivery' }
               ].map((item, i) => (
                 <div key={i} className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-[10px] font-black">{item.step}</div>
                    <div>
                       <div className="text-xs font-black uppercase tracking-tight text-white">{item.label}</div>
                       <div className="text-[10px] text-neutral-500 font-bold uppercase mt-0.5">{item.desc}</div>
                    </div>
                 </div>
               ))}
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="text-mono-xs text-synapse-primary uppercase tracking-[0.3em]">Security & Privacy</h3>
            <div className="grid gap-4">
               <div className="card p-4 bg-white/5 border-white/5 flex items-center gap-3">
                  <Lock className="w-5 h-5 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-tight">End-to-End Encrypted</span>
               </div>
               <div className="card p-4 bg-white/5 border-white/5 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-synapse-primary" />
                  <span className="text-[10px] font-black uppercase tracking-tight">DPPA 2019 Compliant</span>
               </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const TextInput = ({ type, placeholder, onContinue }: { type: string, placeholder?: string, onContinue: (val: string) => void }) => {
  const [val, setVal] = useState('');
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => { e.preventDefault(); onContinue(val); }}
    >
      <input
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={placeholder || 'Type here...'}
        className="input"
        autoFocus
      />
      <button
        type="submit"
        disabled={!val}
        className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        Continue <ChevronRight className="w-4 h-4" />
      </button>
    </form>
  );
};
