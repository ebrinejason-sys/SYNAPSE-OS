type Avatar = {
  initials: string
  label: string
  gradient: string
}

const AVATARS: Avatar[] = [
  { initials: 'DR', label: 'Doctor', gradient: 'linear-gradient(135deg, #F97316, #EA6500)' },
  { initials: 'RN', label: 'Nurse', gradient: 'linear-gradient(135deg, #E8B84B, #C9960A)' },
  { initials: 'PH', label: 'Pharmacist', gradient: 'linear-gradient(135deg, #1FA6A6, #178A8A)' },
  { initials: 'LT', label: 'Lab technician', gradient: 'linear-gradient(135deg, #22C55E, #16A34A)' },
]

type AvatarClusterProps = {
  caption?: string
}

export function AvatarCluster({
  caption = 'Built with clinicians and pharmacists in Kampala',
}: AvatarClusterProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2.5">
        {AVATARS.map((a) => (
          <span
            key={a.initials}
            title={a.label}
            aria-label={a.label}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold"
            style={{
              background: a.gradient,
              color: '#07070A',
              border: '2px solid var(--bg-base)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            }}
          >
            {a.initials}
          </span>
        ))}
      </div>
      <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)', maxWidth: '14rem' }}>
        {caption}
      </p>
    </div>
  )
}
