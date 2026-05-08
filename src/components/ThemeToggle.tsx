import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "p-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all group",
        className
      )}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-synapse-primary group-hover:rotate-45 transition-transform" />
      ) : (
        <Moon className="w-4 h-4 text-synapse-primary group-hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
}
