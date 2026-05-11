import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'light' | 'dark' | 'default';
  text?: React.ReactNode;
}

const Logo: React.FC<LogoProps> = ({
  className,
  size = 'md',
  showText = true,
  variant = 'default',
  text
}) => {
  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      <div className={cn(
        "relative rounded-xl overflow-hidden transition-transform group-hover:scale-105 shadow-lg flex-shrink-0",
        size === 'sm' ? 'w-8 h-8' :
        size === 'md' ? 'w-10 h-10' :
        size === 'lg' ? 'w-12 h-12' : 'w-20 h-20',
        "shadow-cyan-500/20 bg-synapse-black border border-white/10"
      )}>
        <img
          src="/assets/logos/synapse-logo.png"
          alt="Synapse Logo"
          className="w-full h-full object-contain p-1.5"
        />
      </div>

      {showText && (
        <span className={cn(
          "font-black tracking-tighter uppercase transition-colors",
          textSizes[size],
          variant === 'light' ? 'text-white' :
          variant === 'dark' ? 'text-synapse-black' :
          'text-white'
        )}>
          {text || <>Synapse<span className="text-synapse-primary">OS</span></>}
        </span>
      )}
    </div>
  );
};

export default Logo;
