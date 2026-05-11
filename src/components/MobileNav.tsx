import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Menu, X, ChevronRight } from 'lucide-react';
import { Logo } from './Logo';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { label: 'Features', href: '/features' },
    { label: 'Departments', href: '#departments' },
    { label: 'Telemedicine', href: '/tele' },
    { label: 'Demo Sandbox', href: '/demo' },
    { label: 'Pricing Tiers', href: '#pricing' },
    { label: 'About Team', href: '/about' },
  ];

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpen(true)}
        className="p-1.5 hover:bg-white/5 rounded-lg transition-all"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-white" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[300] bg-synapse-black/98 backdrop-blur-2xl p-4 sm:p-8 flex flex-col"
          >
            <div className="flex items-center justify-between mb-12">
               <Logo size="sm" />
               <button
                 onClick={() => setIsOpen(false)}
                 className="p-2 hover:bg-white/5 rounded-xl transition-all"
               >
                 <X className="w-6 h-6 text-neutral-500" />
               </button>
            </div>

            <nav className="flex-1 space-y-1">
               {links.map((link, i) => (
                 <motion.div
                   key={link.label}
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: i * 0.04 }}
                 >
                   <Link
                     to={link.href}
                     onClick={() => setIsOpen(false)}
                     className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-all group"
                   >
                     <span className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400 group-hover:text-white transition-colors">{link.label}</span>
                     <ChevronRight className="w-4 h-4 text-neutral-700 group-hover:text-synapse-primary transition-colors" />
                   </Link>
                 </motion.div>
               ))}
            </nav>

            <div className="pt-8 border-t border-white/5 space-y-3">
               <Link
                 to="/login"
                 onClick={() => setIsOpen(false)}
                 className="btn-secondary w-full py-4 flex items-center justify-center text-[10px] tracking-[0.2em]"
               >
                 SIGN IN
               </Link>
               <Link
                 to="/apply"
                 onClick={() => setIsOpen(false)}
                 className="btn-primary w-full py-4 flex items-center justify-center text-[10px] tracking-[0.2em]"
               >
                 GET STARTED
               </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
