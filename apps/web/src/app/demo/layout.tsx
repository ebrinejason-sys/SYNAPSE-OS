import type { ReactNode } from "react"
import "./demo-surface.css"

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <div className="demo-surface">{children}</div>
}
