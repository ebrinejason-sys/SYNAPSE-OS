import type { ReactNode } from 'react'

interface DepartmentShellProps {
  patientBanner?: ReactNode
  queuePanel: ReactNode
  children: ReactNode
}

export function DepartmentShell({ patientBanner, queuePanel, children }: DepartmentShellProps) {
  return (
    <div className="flex h-full flex-col">
      {patientBanner && (
        <div className="border-b border-[var(--synapse-border)] px-4 py-3">{patientBanner}</div>
      )}
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="w-full border-b border-[var(--synapse-border)] p-4 md:w-80 md:border-b-0 md:border-r">
          {queuePanel}
        </aside>
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  )
}
