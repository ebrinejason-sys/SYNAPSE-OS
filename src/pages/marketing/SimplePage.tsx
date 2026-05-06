import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function SimplePage() {
  const location = useLocation();
  const title = location.pathname.split('/').pop()?.replace(/-/g, ' ') || 'Page';

  return (
    <div className="min-h-screen bg-white p-12">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-green-600 mb-12 uppercase tracking-widest transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back Home
        </Link>
        
        <div className="inline-block px-3 py-1 bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-[0.2em] rounded mb-6">
           Synapse Ecosystem Documentation
        </div>
        
        <h1 className="text-4xl font-bold text-[#0F172A] capitalize mb-8">{title}</h1>
        
        <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-6">
           <p>
             The <strong>{title}</strong> for the Synapse Ecosystem is currently being codified into our final production release. As a sovereign AI health operating system, we prioritize transparency and detailed documentation.
           </p>
           <p>
             Our core mission is to provide resilient, offline-first digital infrastructure for African healthcare facilities. Every policy, including our {title}, is grounded in maintaining the highest standards of data sovereignty and clinical safety.
           </p>
           <div className="p-8 bg-gray-50 rounded-3xl border border-gray-100">
              <h3 className="font-bold text-[#0F172A] mb-4">Key Principles</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                 <li>Data Sovereignty: Information belongs to the facility and the patient.</li>
                 <li>Clinical Safety: Grounded in national guidelines (UCG).</li>
                 <li>Transparency: Open-standard FHIR R4 interoperability.</li>
              </ul>
           </div>
           <p>
             For immediate inquiries regarding this section, please contact our team at <code>ops@synapseos.tech</code> or reach out via our pilot application portal.
           </p>
        </div>
      </div>
    </div>
  );
}
