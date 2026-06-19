import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-subtle bg-surface/50 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E8B84B]/25 bg-[#E8B84B]/10">
        <Icon className="h-5 w-5 text-[#E8B84B]" />
      </div>
      <p className="mt-4 text-sm font-semibold text-primary-color">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-color">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
