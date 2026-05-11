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
  Stethoscope
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { CHATBOT_STEPS, calculateTriage } from '../../lib/chatbot-engine';
import { Logo } from '../../components/Logo';

interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

export default function TeleChatbot() {
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(-1); // -1 is welcome
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

    // Add user message
    const displayVal = Array.isArray(val) ? val.join(', ') : val;
    const newMessages = [...messages, { role: 'user', content: String(displayVal) }];

    // Find next step
    let nextIndex = currentStepIndex + 1;
    while (nextIndex < CHATBOT_STEPS.length) {
      const nextStep = CHATBOT_STEPS[nextIndex];
      if (!nextStep.condition || nextStep.condition(newAnswers)) {
        break;
      }
      nextIndex++;
    }

    if (nextIndex < CHATBOT_STEPS.length) {
      setCurrentStepIndex(nextIndex);
      setMessages([...newMessages, { role: 'ai', content: CHATBOT_STEPS[nextIndex].question }]);
    } else {
      // End of chatbot
      const result = calculateTriage(newAnswers);
      setTriageResult(result);
      setCurrentStepIndex(CHATBOT_STEPS.length);
    }
  };

  const renderInput = () => {
    if (currentStepIndex < 0 || currentStepIndex >= CHATBOT_STEPS.length) return null;
    const step = CHATBOT_STEPS[currentStepIndex];

    if (step.type === 'select') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
          {step.options?.map(opt => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              className="p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-synapse-primary hover:text-synapse-black transition-all"
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if (step.type === 'multiselect') {
      const [selected, setSelected] = useState<string[]>([]);
      return (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {step.options?.map(opt => (
              <button
                key={opt}
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
            disabled={selected.length === 0}
            onClick={() => handleAnswer(selected)}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      );
    }

    if (step.type === 'scale') {
      return (
        <div className="mt-4 space-y-6">
          <div className="flex justify-between px-2">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button
                key={n}
                onClick={() => handleAnswer(n)}
                className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-black hover:bg-synapse-primary hover:text-synapse-black transition-all"
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
      const [val, setVal] = useState('');
      return (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => { e.preventDefault(); handleAnswer(val); }}
        >
          <input
            type={step.type}
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder={step.placeholder || 'Type here...'}
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
              <div className="text-mono-xs text-neutral-500">Nearest SynapseOS Facility</div>
              <div>
                 <div className="text-lg font-black uppercase">Mulago National Referral Hospital</div>
                 <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
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
           <div className="text-mono-xs text-neutral-500">Available Today</div>
           <div className="space-y-2">
              {[
                { name: 'Dr. Okello Moses', spec: 'General Medicine', time: '10:30 AM' },
                { name: 'Dr. Nalwoga Sarah', spec: 'Family Medicine', time: '2:15 PM' }
              ].map((doc, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/tele/booking?doctor=${i}&name=${doc.name}&time=${doc.time}`)}
                  className="w-full card p-4 flex items-center justify-between hover:border-synapse-primary transition-all group"
                >
                   <div className="text-left">
                      <div className="text-sm font-black uppercase group-hover:text-synapse-primary transition-colors">{doc.name}</div>
                      <div className="text-[10px] text-neutral-500 font-bold uppercase">{doc.spec}</div>
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
    <div className="min-h-screen bg-synapse-black text-white selection:bg-synapse-primary/30 selection:text-cyan-200 flex flex-col">
      <nav className="h-16 border-b border-white/5 bg-synapse-black/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-8">
           <Link to="/" className="text-neutral-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
           </Link>
           <Logo size="sm" />
        </div>
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-widest">Live Network</span>
        </div>
      </nav>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col bg-synapse-black border-r border-white/5 relative">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === 'ai' ? "items-start" : "items-end self-end"
                  )}
                >
                   {msg.role === 'ai' && (
                     <div className="flex items-center gap-2 mb-2 text-[10px] font-black text-synapse-primary uppercase tracking-widest">
                        <Activity className="w-3 h-3" /> AI Assistant
                     </div>
                   )}
                   <div className={cn(
                     "px-6 py-4 rounded-2xl text-sm font-bold leading-relaxed",
                     msg.role === 'ai'
                      ? "bg-emerald-500/10 text-neutral-200 border border-emerald-500/20 rounded-tl-none"
                      : "bg-synapse-primary text-synapse-black rounded-tr-none shadow-lg shadow-cyan-500/10"
                   )}>
                     {msg.content}
                   </div>
                </motion.div>
              ))}

              {currentStepIndex >= 0 && currentStepIndex < CHATBOT_STEPS.length && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-4"
                >
                   <div className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-4">Your Answer</div>
                   {renderInput()}
                </motion.div>
              )}

              {triageResult && renderTriage()}
            </AnimatePresence>
          </div>

          {currentStepIndex === -1 && (
            <div className="p-8 border-t border-white/5 bg-synapse-dark/50">
               <button
                 onClick={handleStart}
                 className="btn-primary w-full py-5 flex items-center justify-center gap-3 text-sm shadow-2xl"
               >
                 START CONSULTATION <ArrowRight className="w-4 h-4" />
               </button>
            </div>
          )}

          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-synapse-black text-mono-xs text-neutral-700">
             <span>PROGRESS: STEP {Math.max(0, currentStepIndex + 1)} OF 13</span>
             <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(Math.max(0, currentStepIndex + 1) / 13) * 100}%` }}
                  className="h-full bg-emerald-500"
                />
             </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="hidden lg:block w-[400px] p-10 bg-synapse-dark/50 space-y-12 overflow-y-auto">
          <section className="space-y-6">
            <h3 className="text-mono-xs text-synapse-primary">How It Works</h3>
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
            <h3 className="text-mono-xs text-synapse-primary">Security & Compliance</h3>
            <div className="grid gap-4">
               <div className="card p-4 bg-white/5 border-white/5 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-tight">End-to-End Encrypted</span>
               </div>
               <div className="card p-4 bg-white/5 border-white/5 flex items-center gap-3">
                  <Stethoscope className="w-5 h-5 text-synapse-primary" />
                  <span className="text-[10px] font-black uppercase tracking-tight">Clinically Validated Triage</span>
               </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ArrowRight(props: any) {
  return <ChevronRight {...props} />;
}
