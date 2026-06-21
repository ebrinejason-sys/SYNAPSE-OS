import { ComingSoon } from '../../components/ComingSoon'

export const metadata = { title: 'Changelog · SynapseOS' }

export default function ChangelogPage() {
  return (
    <ComingSoon
      title="Changelog"
      subtitle="Release notes covering new modules, clinical tools, and platform improvements will be published here. Subscribe to follow what ships."
      showNotify
    />
  )
}
