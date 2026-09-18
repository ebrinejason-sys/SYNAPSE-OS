import DemoNotFound from "../not-found"

/** Unknown /demo/* paths recover here instead of the default Next.js 404. */
export default function DemoCatchAllPage() {
  return <DemoNotFound />
}
