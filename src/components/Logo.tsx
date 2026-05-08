import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark' | 'auto';
  showText?: boolean;
}

export function Logo({ className, size = 'md', variant = 'auto', showText = true }: LogoProps) {
  const sizeMap = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  const textMap = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl'
  };

  return (
    <div className={cn("flex items-center gap-2 group cursor-pointer", className)}>
      <div className={cn(
        "bg-synapse-primary rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 transition-all group-hover:scale-110",
        sizeMap[size]
      )}>
        <img
          src="/assets/logos/synapse-logo.png"
          alt="Synapse OS"
          className="w-[80%] h-[80%] object-contain brightness-0 invert"
        />
      </div>
      {showText && (
        <span className={cn(
          "font-black tracking-tighter uppercase transition-colors",
          textMap[size],
          variant === 'light' ? 'text-white' : variant === 'dark' ? 'text-synapse-black' : 'text-current'
        )}>
          Synapse<span className="text-synapse-primary">OS</span>
        </span>
      )}
    </div>
  );
}
