import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  ShieldCheck,
  Clock,
  Phone,
  AlertCircle,
  CheckCircle2,
  Calendar,
  MessageSquare,
  Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SynapseLogo } from '../../components/ui/SynapseLogo';
import { CHATBOT_STEPS, calculateTriage, TriageResult } from '../../lib/chatbot-engine';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  content: string | React.ReactNode;
}

export default function TelemedicinePage() {
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      content: "Hello! I'm your AI health guide. I'll ask you a few questions to understand your symptoms. This takes about 2 minutes."
    }
  ]);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const currentStep = currentStepIndex >= 0 && currentStepIndex < CHATBOT_STEPS.length
    ? CHATBOT_STEPS[currentStepIndex]
    : null;

  const handleStart = () => {
    setCurrentStepIndex(0);
    const firstStep = CHATBOT_STEPS[0];
    setMessages(prev => [...prev, {
      id: `step-${firstStep.id}`,
      sender: 'ai',
      content: firstStep.question
    }]);
  };

  const handleAnswer = (answer: any, label?: string) => {
    const updatedAnswers = { ...answers, [currentStep!.key]: answer };
    setAnswers(updatedAnswers);

    setMessages(prev => [...prev, {
      id: `answer-${currentStep!.id}`,
      sender: 'user',
      content: label || String(answer)
    }]);

    let nextIndex = currentStepIndex + 1;
    while (nextIndex < CHATBOT_STEPS.length) {
      const nextStep = CHATBOT_STEPS[nextIndex];
      if (!nextStep.condition || nextStep.condition(updatedAnswers)) break;
      nextIndex++;
    }

    setTimeout(() => {
      if (nextIndex < CHATBOT_STEPS.length) {
        setCurrentStepIndex(nextIndex);
        const nextStep = CHATBOT_STEPS[nextIndex];

        let extraContent = null;
        if (nextStep.key === 'district') {
          extraContent = (
            <div className="mt-2 p-2 bg-gold/10 border border-gold/20 rounded-lg flex items-start gap-2">
              <MapPin className="w-3 h-3 text-gold shrink-0 mt-0.5" />
              <span className="text-[10px] text-gold font-bold leading-tight">This helps us find the nearest SynapseOS facility and provide relevant public health alerts.</span>
            </div>
          );
        }

        setMessages(prev => [...prev, {
          id: `step-${nextStep.id}`,
          sender: 'ai',
          content: (
            <div>
              <p>{nextStep.question}</p>
              {extraContent}
            </div>
          )
        }]);
      } else {
        const result = calculateTriage(updatedAnswers);
        setTriageResult(result);
        setCurrentStepIndex(CHATBOT_STEPS.length);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-ink text-text-1">
      {/* Navigation */}
      <header className="h-16 border-b border-edge flex items-center justify-between px-6 sticky top-0 z-50 bg-ink/80 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-2 text-text-3 hover:text-text-1 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Home</span>
        </Link>
        <SynapseLogo />
        <div className="w-4" />
      </header>

      <main className="max-w-7xl mx-auto flex flex-col md:flex-row h-[calc(100vh-64px)]">
        {/* Left Panel: Chatbot */}
        <div className="flex-1 md:w-[60%] border-r border-edge flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.sender === 'ai' ? "mr-auto items-start" : "ml-auto items-end"
                  )}
                >
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm font-medium",
                    msg.sender === 'ai'
                      ? "bg-surface-2 text-text-1 border border-edge rounded-tl-none"
                      : "bg-gold/10 text-text-1 border border-gold/20 rounded-tr-none"
                  )}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {currentStepIndex === CHATBOT_STEPS.length && triageResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full"
                >
                  <TriageDisplay result={triageResult} answers={answers} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-edge bg-surface-1/30">
            {currentStepIndex === -1 && (
              <button type="button" onClick={handleStart} className="btn-primary w-full group">
                Start Consultation <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform inline" />
              </button>
            )}

            {currentStep && (
              <div className="space-y-4">
                {currentStep.type === 'select' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {currentStep.options?.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleAnswer(opt)}
                        className="px-3 py-2 bg-surface-2 border border-edge rounded-xl text-[10px] font-bold uppercase tracking-wider hover:border-gold hover:bg-gold/10 transition-all text-text-3 hover:text-text-1"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {currentStep.type === 'scale' && (
                  <div className="space-y-4">
                    <div className="flex justify-between px-1">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleAnswer(val)}
                          className="w-8 h-8 rounded-full border border-edge flex items-center justify-center text-xs font-bold hover:bg-gold hover:text-ink hover:border-gold transition-all"
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between label-xs">
                      <span>Mild</span>
                      <span>Unbearable</span>
                    </div>
                  </div>
                )}

                {currentStep.type === 'multiselect' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {currentStep.options?.map(opt => (
                        <label key={opt} className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-edge cursor-pointer hover:border-edge-strong transition-all group">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-edge bg-transparent text-gold focus:ring-gold"
                            onChange={(e) => {
                              const current = answers[currentStep.key] || [];
                              if (e.target.checked) {
                                setAnswers({ ...answers, [currentStep.key]: [...current, opt] });
                              } else {
                                setAnswers({ ...answers, [currentStep.key]: current.filter((x: string) => x !== opt) });
                              }
                            }}
                          />
                          <span className="label-xs text-text-3 group-hover:text-text-1">{opt}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAnswer(answers[currentStep.key] || ['None'], (answers[currentStep.key] || ['None']).join(', '))}
                      className="btn-primary w-full"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {(currentStep.type === 'text' || currentStep.type === 'number') && (
                  <div className="flex gap-2">
                    <input
                      type={currentStep.type}
                      placeholder={currentStep.placeholder}
                      className="input"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAnswer((e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                        handleAnswer(input.value);
                      }}
                      className="btn-primary"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {currentStep.key === 'insurance' && answers.insurance === 'Yes — I have insurance' && (
                  <div className="p-3 bg-emerald/10 border border-emerald/20 rounded-xl flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4 text-emerald" />
                    </div>
                    <div>
                      <p className="label-xs text-emerald mb-1">Insurance Sync Available</p>
                      <p className="text-[10px] text-text-3 font-medium leading-relaxed">You can sync your insurance details on admission. Download the Synapse App to store your insurance card.</p>
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="pt-4 space-y-2">
                  <div className="flex justify-between label-xs">
                    <span>Progress</span>
                    <span>Step {currentStepIndex + 1} of {CHATBOT_STEPS.length}</span>
                  </div>
                  <div className="h-1 w-full bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold transition-all duration-500"
                      style={{ width: `${((currentStepIndex + 1) / CHATBOT_STEPS.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Info */}
        <div className="hidden md:flex md:w-[40%] bg-surface-1/20 flex-col p-8 space-y-12 overflow-y-auto">
          <section>
            <h3 className="label-sm text-gold mb-6">How It Works</h3>
            <div className="space-y-6">
              {[
                { icon: MessageSquare, text: "Answer questions (2 min)" },
                { icon: Activity, text: "Get triaged" },
                { icon: Calendar, text: "See a doctor via video" },
                { icon: ShieldCheck, text: "Receive prescription" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-surface-2 border border-edge flex items-center justify-center group-hover:border-gold/50 transition-colors">
                    <item.icon className="w-4 h-4 text-text-3 group-hover:text-gold transition-colors" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-text-2">
                    <span className="text-gold mr-2">{i + 1}.</span> {item.text}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="label-sm mb-6">Available Doctors Today</h3>
            <div className="space-y-4">
              {[
                { name: 'Dr. Okello Moses', spec: 'General Medicine', status: 'available' },
                { name: 'Dr. Nalwoga Sarah', spec: 'Family Medicine', status: 'available' },
                { name: 'Dr. Ssemwanga John', spec: 'Paediatrics', status: 'limited' },
              ].map((doc, i) => (
                <div key={i} className="p-4 rounded-2xl bg-surface-2 border border-edge flex items-center justify-between group hover:bg-surface-3 transition-colors">
                  <div>
                    <p className="text-xs font-bold text-text-1 mb-1">{doc.name}</p>
                    <p className="label-xs">{doc.spec}</p>
                  </div>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    doc.status === 'available' ? "bg-emerald animate-pulse" : "bg-amber"
                  )} />
                </div>
              ))}
            </div>
          </section>

          <footer className="pt-8 mt-auto border-t border-edge space-y-4">
            {[
              { icon: ShieldCheck, text: "All consultations are encrypted" },
              { icon: ShieldCheck, text: "Uganda DPPA 2019 compliant" },
              { icon: Activity, text: "AI assists — doctor decides" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 label-xs">
                <item.icon className="w-3 h-3 text-gold" />
                {item.text}
              </div>
            ))}
          </footer>
        </div>
      </main>
    </div>
  );
}

function TriageDisplay({ result, answers }: { result: TriageResult, answers: any }) {
  const navigate = useNavigate();

  const handleBooking = () => {
    navigate(`/tele/booking?triage=${result.level}&district=${answers.district || 'Kampala'}`);
  };

  if (result.level === 'emergency') {
    return (
      <div className="space-y-6">
        <div className="p-8 rounded-3xl bg-red text-white shadow-2xl shadow-red/20">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-8 h-8" />
            <h2 className="text-3xl font-black uppercase tracking-tighter">Emergency</h2>
          </div>
          <p className="text-lg font-bold leading-tight mb-2">Based on your symptoms, you need immediate medical attention.</p>
          <p className="text-sm opacity-90 mb-8 font-medium">Please call 999 or go to the nearest emergency room NOW.</p>

          <div className="p-6 bg-black/20 rounded-2xl border border-white/20 backdrop-blur-sm mb-8">
            <h4 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-70">Nearest SynapseOS Hospital</h4>
            <p className="text-lg font-black mb-1">Mulago National Referral Hospital</p>
            <div className="flex items-center gap-2 text-xs font-bold mb-4 opacity-80">
              <MapPin className="w-3 h-3" /> 2.3 km away
            </div>
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Phone className="w-3 h-3" /> +256 414 554 000
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-red-100">
                <Activity className="w-3 h-3" /> Emergency department — open 24/7
              </div>
            </div>
            <button type="button" className="w-full py-3 bg-white text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-neutral-100 transition-colors">
              Get Directions
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button type="button" className="py-4 bg-white/10 hover:bg-white/20 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
              Call 999
            </button>
            <button type="button" className="py-4 bg-white/10 hover:bg-white/20 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">
              Share Location
            </button>
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-red" />
            </div>
            <div>
              <p className="text-xs font-bold text-text-1">Medical ID Prepared</p>
              <p className="label-xs">Show to first responder</p>
            </div>
          </div>
          <button type="button" className="btn-ghost text-xs border border-edge">View ID</button>
        </div>
      </div>
    );
  }

  const isUrgent = result.level === 'urgent';

  return (
    <div className="space-y-6">
      <div className={cn(
        "p-8 rounded-3xl shadow-2xl transition-all",
        isUrgent ? "bg-amber text-ink shadow-amber/20" : "bg-emerald text-ink shadow-emerald/20"
      )}>
        <div className="flex items-center gap-3 mb-6">
          {isUrgent ? <Clock className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
          <h2 className="text-3xl font-black uppercase tracking-tighter">
            {isUrgent ? 'Urgent' : 'Routine'}
          </h2>
        </div>
        <p className="text-lg font-black leading-tight mb-2">
          {isUrgent ? 'You should see a doctor today' : 'Your symptoms can be safely assessed in a scheduled appointment'}
        </p>
        <p className="text-sm font-bold opacity-80 mb-8">
          {result.explanation}
        </p>

        <button type="button" onClick={handleBooking} className="w-full py-4 bg-ink text-text-1 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-surface-1 transition-all shadow-xl flex items-center justify-center group">
          {isUrgent ? 'See Available Appointments' : 'Browse Appointments'}
          <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="card p-6">
        <h4 className="label-sm mb-4">Available {isUrgent ? 'Today' : 'This Week'}</h4>
        <div className="space-y-3">
          {[
            { name: 'Dr. Okello Moses', time: '10:30 AM', slots: '1 slot' },
            { name: 'Dr. Nalwoga Sarah', time: '2:15 PM', slots: '2 slots' },
            { name: 'Dr. Ssemwanga John', time: '4:00 PM', slots: '1 slot' },
          ].map((slot, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-edge hover:border-gold/50 transition-colors group cursor-pointer" onClick={handleBooking}>
              <div>
                <p className="text-xs font-bold text-text-1 mb-0.5 group-hover:text-gold transition-colors">{slot.name}</p>
                <p className="label-xs">{slot.slots} available</p>
              </div>
              <div className="label-xs text-gold bg-gold/10 px-3 py-1.5 rounded-lg border border-gold/20">
                {slot.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
