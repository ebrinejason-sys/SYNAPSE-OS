import { ComingSoon } from '../../components/ComingSoon'

export const metadata = { title: 'Blog · SynapseOS' }

export default function BlogPage() {
  return (
    <ComingSoon
      title="Blog"
      subtitle="Notes on clinical informatics, health systems in East Africa, and how we build SynapseOS will live here. Subscribe to read them first."
      showNotify
    />
  )
}
