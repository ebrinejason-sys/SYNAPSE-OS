"use client";

import { usePathname } from "next/navigation";

function toLabel(segment: string) {
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function PlatformBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const platformIndex = segments.findIndex((segment) => segment === "platform");
  const relevant = platformIndex >= 0 ? segments.slice(platformIndex + 1) : [];

  return (
    <div className="text-sm text-slate-300">
      <span className="text-slate-500">Platform</span>
      {relevant.map((segment) => (
        <span key={segment}>
          <span className="mx-2 text-slate-600">/</span>
          <span>{toLabel(segment)}</span>
        </span>
      ))}
    </div>
  );
}
