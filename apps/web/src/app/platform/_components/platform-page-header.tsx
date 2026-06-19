import type { ReactNode } from "react";

type PlatformPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PlatformPageHeader({ eyebrow, title, description, actions }: PlatformPageHeaderProps) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8B84B]">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold text-primary-color sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-color">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}
