/** Interlocking double-S knot with Adinkra-style chevron inlays (Synapse Pharm mark). */
export function KnotMark({
  className = "h-10 w-10",
  title = "Synapse Pharm",
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path
        d="M18 14c8-6 20-6 28 0 6 4.5 8 12 4 18-2.5 4-7 7-12 8 5 1 9.5 4 12 8 4 6 2 13.5-4 18-8 6-20 6-28 0-6-4.5-8-12-4-18 2.5-4 7-7 12-8-5-1-9.5-4-12-8-4-6-2-13.5 4-18Z"
        stroke="url(#knotStroke)"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M22 22l6 4-6 4M42 34l-6 4 6 4"
        stroke="#E8B84B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 20v8M32 36v8"
        stroke="#1FA6A6"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="knotStroke" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F97316" />
          <stop offset="0.55" stopColor="#E8B84B" />
          <stop offset="1" stopColor="#1FA6A6" />
        </linearGradient>
      </defs>
    </svg>
  )
}
