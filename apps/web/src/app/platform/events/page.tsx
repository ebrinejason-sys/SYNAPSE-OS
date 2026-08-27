import { Suspense } from "react"
import EventExplorerPage from "./explorer"

export default function EventsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-color">Loading event explorer…</p>}>
      <EventExplorerPage />
    </Suspense>
  )
}
