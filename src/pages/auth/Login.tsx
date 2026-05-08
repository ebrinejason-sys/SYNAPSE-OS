import React, { useState } from "react";
import { motion } from 'motion/react';
import { Activity, Mail, Lock, ArrowRight, Github, Info, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Artificial delay for realism
    setTimeout(() => {
      if (email === 'demodoc@synapseos.tech' && password === 'Demo4321') {
        navigate('/doctor/queue');
      } else if (email === 'demopat@synapseos.tech' && password === 'Demo1234') {
        navigate('/app/dashboard');
      } else {
        setError('Invalid credentials. Please use the demo accounts provided below.');
        setIsLoading(false);
      }
    }, 800);
  };

  const fillDemo = (role: 'doctor' | 'patient') => {
    if (role === 'doctor') {
      setEmail('demodoc@synapseos.tech');
      setPassword('Demo4321');
    } else {
      setEmail('demopat@synapseos.tech');
      setPassword('Demo1234');
    }
    setError(null);
  };

  return (
    <div className="min-h-screen bg-synapse-black text-white font-sans flex items-center justify-center p-6 selection:bg-synapse-primary/30 selection:text-cyan-200">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-synapse-primary to-transparent opacity-20" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 group mb-8">
            <div className="w-10 h-10 bg-synapse-primary rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 transition-transform group-hover:scale-110">
              <Activity className="w-6 h-6 text-synapse-black" />
            </div>
            <span className="font-black text-2xl tracking-tighter uppercase text-white">Synapse<span className="text-synapse-primary">OS</span></span>
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Welcome Back</h1>
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Sign in to your clinical workspace</p>
        </div>

        <form onSubmit={handleLogin} className="card p-8 space-y-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3 text-red-400 text-[11px] font-bold uppercase tracking-wider"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-mono-xs text-neutral-600 ml-1 uppercase">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@facility.com"
                  className="input pl-11"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-mono-xs text-neutral-600 uppercase">Password</label>
                <button type="button" className="text-[10px] font-bold text-synapse-primary uppercase tracking-widest hover:underline">Forgot?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-11"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {isLoading ? 'Authenticating...' : 'Sign In to Workspace'}
            {!isLoading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
          </button>

          <div className="pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 mb-4 text-[10px] font-black text-neutral-600 uppercase tracking-widest">
              <Info className="w-3.5 h-3.5" /> Demo Accounts
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fillDemo('doctor')}
                className="p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors text-left"
              >
                <span className="text-synapse-primary block mb-1">Doctor View</span>
                Clinical Workspace
              </button>
              <button
                type="button"
                onClick={() => fillDemo('patient')}
                className="p-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors text-left"
              >
                <span className="text-synapse-primary block mb-1">Patient View</span>
                Community App
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
              <span className="bg-synapse-dark px-4 text-neutral-600">Or continue with</span>
            </div>
          </div>

          <button type="button" className="btn-secondary w-full py-4 flex items-center justify-center gap-2">
            <Github className="w-4 h-4" /> Provider SSO
          </button>
        </form>

        <p className="mt-8 text-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
          New to Synapse? <Link to="/signup" className="text-synapse-primary hover:underline">Apply for pilot access</Link>
        </p>
      </motion.div>
    </div>
  );
}
