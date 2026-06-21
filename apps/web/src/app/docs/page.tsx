import { ComingSoon } from '../../components/ComingSoon'

export const metadata = { title: 'Documentation · SynapseOS' }

export default function DocsPage() {
  return (
    <ComingSoon
      title="Documentation"
      subtitle="Implementation guides, API references, and clinical workflow docs are being prepared for hospital IT teams and integrators. Sign up to be notified when they go live."
      showNotify
    />
  )
}
