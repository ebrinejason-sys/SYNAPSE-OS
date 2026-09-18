import type { ReactNode } from "react"
import "./demo-surface.css"
import { DEMO_THEME_FOUC } from "../../lib/demo/stations"

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="demo-surface">
      <script dangerouslySetInnerHTML={{ __html: DEMO_THEME_FOUC }} />
      {children}
    </div>
  )
}
