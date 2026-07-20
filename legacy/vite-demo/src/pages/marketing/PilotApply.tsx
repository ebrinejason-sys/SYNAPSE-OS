import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Building, MapPin, Users, Send, ChevronRight, CheckCircle2, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SynapseLogo } from '../../components/ui/SynapseLogo';

interface FormData {
  name: string;
  email: string;
  facility: string;
  location: string;
  facilityType: string;
  staffCount: string;
  challenge: string;
}

export default function PilotApply() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    facility: '',
    location: '',
    facilityType: 'General Hospital',
    staffCount: '',
    challenge: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const update = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(
        'https://qfqakzmjatszisuqjwon.supabase.co/functions/v1/send-onboarding',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );
      if (!res.ok) throw new Error('Submission failed');
      setStatus('success');
    } catch {
      setErrorMsg('Something went wrong. Please email founder@synapseos.tech directly.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-ink text-text-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md space-y-8"
        >
          <div className="w-20 h-20 rounded-full bg-emerald/10 border border-emerald/30 flex items-center justify-center mx-auto shadow-2xl">
            <CheckCircle2 className="w-10 h-10 text-emerald" />
          </div>
          <div className="space-y-3">
            <h2 className="heading-2">Application Received!</h2>
            <p className="text-text-3 font-medium">We'll review your application and respond within 2 business days. Check your inbox for a confirmation email.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/" className="btn-outline">Back to Home</Link>
            <Link to="/demo/doctor" className="btn-primary">Explore Demo</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-text-1">
      <nav className="fixed top-0 w-full z-50 bg-ink/80 backdrop-blur-md border-b border-edge h-16 flex items-center justify-between px-6 lg:px-12">
        <Link to="/">
          <SynapseLogo />
        </Link>
        <Link to="/login" className="btn-ghost text-xs">Sign In</Link>
      </nav>

      <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-16">
            <div className="badge-gold inline-flex mb-6">Pilot Program 2026</div>
            <h1 className="heading-1 mb-4">Pilot Application</h1>
            <p className="text-text-3 text-sm font-medium max-w-xl mx-auto leading-relaxed">
              Join the cohort of forward-thinking healthcare facilities building the future of African clinical intelligence.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card-elevated p-8 md:p-12 space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="label-xs">Your Name *</label>
                <input
                  required
                  type="text"
                  className="input"
                  placeholder="Dr. Jane Doe"
                  value={formData.name}
                  onChange={update('name')}
                />
              </div>
              <div className="space-y-2">
                <label className="label-xs">
                  <Mail className="inline w-3 h-3 mr-1" />
                  Email Address *
                </label>
                <input
                  required
                  type="email"
                  className="input"
                  placeholder="you@hospital.ug"
                  value={formData.email}
                  onChange={update('email')}
                />
              </div>
              <div className="space-y-2">
                <label className="label-xs">Facility Name *</label>
                <div className="relative">
                  <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                  <input
                    required
                    type="text"
                    className="input pl-11"
                    placeholder="e.g. Mengo Hospital"
                    value={formData.facility}
                    onChange={update('facility')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label-xs">Location / City</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                  <input
                    type="text"
                    className="input pl-11"
                    placeholder="e.g. Kampala, Uganda"
                    value={formData.location}
                    onChange={update('location')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label-xs">Facility Type</label>
                <select
                  aria-label="Facility type"
                  className="input"
                  value={formData.facilityType}
                  onChange={update('facilityType')}
                >
                  <option>General Hospital</option>
                  <option>Private Clinic</option>
                  <option>Health Center IV</option>
                  <option>Health Center III</option>
                  <option>Specialized Center</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="label-xs">Number of Staff</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                  <input
                    type="text"
                    className="input pl-11"
                    placeholder="e.g. 50–100"
                    value={formData.staffCount}
                    onChange={update('staffCount')}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="label-xs">What is your biggest operational challenge?</label>
              <textarea
                className="input min-h-[120px] resize-none"
                placeholder="Describe how Synapse OS can help your facility..."
                value={formData.challenge}
                onChange={update('challenge')}
              />
            </div>

            {status === 'error' && (
              <p className="text-red text-xs font-bold">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn-primary w-full py-4 flex items-center justify-center gap-3"
            >
              {status === 'loading' ? (
                'Submitting…'
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Application
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center label-xs">
            Our team will review your application and respond within 2 business days.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
