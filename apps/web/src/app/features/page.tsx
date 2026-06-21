import { ComingSoon } from '../../components/ComingSoon'

export const metadata = { title: 'Features · SynapseOS' }

export default function FeaturesPage() {
  return (
    <ComingSoon
      title="Features"
      subtitle="A dedicated deep dive into every capability is in progress. For now, the full feature overview lives on our home page."
      backHref="/#features"
      backLabel="View features overview"
    />
  )
}
