import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { SynapseLogo } from '../ui/SynapseLogo';

const NAV_ITEMS = [
  { label: 'Queue',       path: '/os/doctor/queue' },
  { label: 'Telemedicine', path: '/os/doctor/tele' },
  { label: 'Lab',          path: '#' },
  { label: 'Pharmacy',     path: '#' },
  { label: 'Audit',        path: '/os/audit' },
];

export function OSLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-ink font-body text-text-1 flex flex-col">
      {/* Top bar */}
      <header className="h-14 bg-surface-1/90 backdrop-blur-md border-b border-edge flex items-center justify-between px-6 sticky top-0 z-50 shrink-0">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <SynapseLogo variant="light" />
        </Link>

        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-[10px] font-black text-text-1 uppercase tracking-widest">Dr. Okello Moses</p>
            <p className="text-[10px] text-text-3 font-bold uppercase tracking-widest">Mengo Hospital · OPD</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold font-black text-xs uppercase cursor-pointer hover:bg-gold/20 transition-colors">
            OM
          </div>
        </div>
      </header>

      {/* Sub-nav */}
      <div className="bg-surface-1 border-b border-edge px-6 flex items-center gap-8 sticky top-14 z-40 shrink-0">
        <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-gold/10 border border-gold/20 my-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
          <span className="text-[9px] font-black text-gold uppercase tracking-[0.2em]">Encounter Active</span>
        </div>

        <nav className="flex items-center gap-6 h-11">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.label}
                to={item.path}
                className={cn(
                  'text-[10px] font-black uppercase tracking-[0.2em] h-full flex items-center px-1 border-b-2 transition-all',
                  isActive
                    ? 'text-gold border-gold'
                    : 'text-text-3 border-transparent hover:text-text-2 hover:border-edge-strong'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      <main className="flex-1 bg-ink overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
