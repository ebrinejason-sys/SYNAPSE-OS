import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'dark' | 'light';
}

export const Logo: React.FC<LogoProps> = ({
  className,
  iconOnly = false,
  size = 'md',
  variant = 'dark'
}) => {
  const sizeClasses = {
    sm: { icon: 'w-6 h-6', text: 'text-lg' },
    md: { icon: 'w-8 h-8', text: 'text-xl' },
    lg: { icon: 'w-12 h-12', text: 'text-3xl' },
    xl: { icon: 'w-16 h-16', text: 'text-4xl' }
  };

  const textColors = variant === 'dark'
    ? 'text-slate-900'
    : 'text-white';

  const synapseOsColor = variant === 'dark'
    ? 'text-emerald-600'
    : 'text-emerald-400';

  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      <div className={cn(
        sizeClasses[size].icon,
        "rounded-lg overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105 bg-slate-100"
      )}>
        <img
          src="/assets/logos/synapse-logo.jpg"
          alt="Synapse Logo"
          className="w-full h-full object-cover"
        />
      </div>
      {!iconOnly && (
        <span className={cn(
          "font-extrabold tracking-tighter uppercase",
          sizeClasses[size].text,
          textColors
        )}>
          Synapse<span className={synapseOsColor}>OS</span>
        </span>
      )}
    </div>
  );
};
