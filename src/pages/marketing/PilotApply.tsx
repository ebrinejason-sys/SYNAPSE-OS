import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Building, MapPin, Users, Send, CheckCircle, User } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { sendPilotApplicationNotification } from '../../services/emailService';

export default function PilotApply() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') || 'trial';

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    facilityName: '',
    location: '',
    facilityType: 'General Hospital',
    staffCount: '',
    adminName: '',
    email: '',
    painPoint: '',
    plan: plan
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await sendPilotApplicationNotification(formData);

    if (result.success) {
      setIsSubmitted(true);
    } else {
      alert('Failed to submit application. Please try again or contact us directly.');
    }
    setIsLoading(false);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-synapse-black text-white font-sans flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md text-center"
        >
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-black uppercase mb-4 tracking-tighter">Application Received</h1>
          <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest leading-relaxed mb-10">
            Thank you for applying for the Synapse OS pilot. Our team will review your application and reach out to {formData.email} within 24 hours.
          </p>
          <Link to="/" className="btn-primary inline-block w-full">Return Home</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-synapse-black text-white font-sans selection:bg-synapse-primary/30 selection:text-cyan-200">
      <nav className="fixed top-0 w-full z-50 bg-synapse-black/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between px-6 lg:px-12">
        <Logo size="sm" />
      </nav>

      <div className="pt-20 pb-16 px-3 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 rounded-full bg-synapse-primary/10 border border-synapse-primary/20 text-[10px] font-black text-synapse-primary uppercase tracking-[0.3em] mb-6">
              Pilot Intake — Q2 2026
            </div>
            <h1 className="heading-1 mb-4 uppercase tracking-tight">Apply for <span className="text-synapse-primary">Synapse OS</span></h1>
            <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest max-w-xl mx-auto">
              You are applying for the <span className="text-white">{plan.toUpperCase()}</span> tier.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card p-10 md:p-16 space-y-10">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-mono-xs text-neutral-600">Facility Name</label>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                  <input
                    type="text"
                    className="input pl-11"
                    placeholder="e.g. Mengo Hospital"
                    required
                    value={formData.facilityName}
                    onChange={e => setFormData({...formData, facilityName: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-mono-xs text-neutral-600">Location / City</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                  <input
                    type="text"
                    className="input pl-11"
                    placeholder="e.g. Kampala, Uganda"
                    required
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-mono-xs text-neutral-600">Facility Type</label>
                <select
                  className="input appearance-none cursor-pointer"
                  value={formData.facilityType}
                  onChange={e => setFormData({...formData, facilityType: e.target.value})}
                >
                  <option className="bg-synapse-dark">General Hospital</option>
                  <option className="bg-synapse-dark">Private Clinic</option>
                  <option className="bg-synapse-dark">Health Center IV</option>
                  <option className="bg-synapse-dark">Specialized Center</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-mono-xs text-neutral-600">Number of Staff</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                  <input
                    type="text"
                    className="input pl-11"
                    placeholder="e.g. 50-100"
                    required
                    value={formData.staffCount}
                    onChange={e => setFormData({...formData, staffCount: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-mono-xs text-neutral-600">Administrative Lead Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                  <input
                    type="text"
                    className="input pl-11"
                    placeholder="Your Name"
                    required
                    value={formData.adminName}
                    onChange={e => setFormData({...formData, adminName: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-mono-xs text-neutral-600">Business Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                  <input
                    type="email"
                    className="input pl-11"
                    placeholder="name@facility.com"
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-mono-xs text-neutral-600">What is your biggest operational challenge?</label>
              <textarea
                className="input min-h-[120px] resize-none"
                placeholder="Describe how Synapse OS can help your facility..."
                required
                value={formData.painPoint}
                onChange={e => setFormData({...formData, painPoint: e.target.value})}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-5 flex items-center justify-center gap-3 text-sm disabled:opacity-50"
            >
              {isLoading ? 'SUBMITTING...' : (
                <>
                  <Send className="w-4 h-4" /> SUBMIT APPLICATION
                </>
              )}
            </button>
          </form>

          <p className="mt-12 text-center text-mono-xs text-neutral-700">
            Our team will review your application and respond within 24 hours.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
