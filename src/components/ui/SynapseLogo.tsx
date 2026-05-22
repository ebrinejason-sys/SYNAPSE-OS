interface SynapseLogoProps {
  variant?: 'light' | 'dark';
  className?: string;
}

interface SynapseIconProps {
  size?: number;
  className?: string;
}

export function SynapseLogo({ className = '' }: SynapseLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/assets/logos/synapse-logo.png"
        alt="SynapseOS"
        className="w-8 h-8 rounded-lg object-cover"
      />
      <span className="font-display font-extrabold text-xl tracking-tight uppercase">
        Synapse<span className="text-gold">OS</span>
      </span>
    </div>
  );
}

export function SynapseIcon({ size = 64, className = '' }: SynapseIconProps) {
  return (
    <img
      src="/assets/logos/synapse-logo.png"
      alt="SynapseOS"
      width={size}
      height={size}
      className={`rounded-2xl object-cover ${className}`}
    />
  );
}
